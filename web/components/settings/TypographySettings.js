"use client";

import { useEffect, useState } from 'react';
import { Check, RefreshCw } from 'lucide-react';
import {
  FONT_FAMILIES,
  FONT_SIZES,
  getFontFamily,
  getFontSize,
  resetFontSettings,
  setFontFamily,
  setFontSize,
} from '@/utils/fontSettings';

const SIZE_OPTIONS = [
  { key: FONT_SIZES.sm, label: 'Small', short: 'S', sample: 'text-[12px]' },
  { key: FONT_SIZES.md, label: 'Medium', short: 'M', sample: 'text-[15px]', default: true },
  { key: FONT_SIZES.lg, label: 'Large', short: 'L', sample: 'text-[18px]' },
  { key: FONT_SIZES.xl, label: 'Extra Large', short: 'XL', sample: 'text-[21px]' },
];

const FAMILY_OPTIONS = [
  { key: FONT_FAMILIES.default, label: 'Default', description: 'Poppins — clean, modern' },
  { key: FONT_FAMILIES.serif, label: 'Serif', description: 'Lora — editorial, warm' },
  { key: FONT_FAMILIES.mono, label: 'Mono', description: 'JetBrains Mono — technical' },
  { key: FONT_FAMILIES.dyslexic, label: 'Dyslexic', description: 'OpenDyslexic — accessible' },
];

export default function TypographySettings() {
  const [currentFontSize, setCurrentFontSize] = useState(FONT_SIZES.md);
  const [currentFontFamily, setCurrentFontFamily] = useState(FONT_FAMILIES.default);

  useEffect(() => {
    setCurrentFontSize(getFontSize());
    setCurrentFontFamily(getFontFamily());

    const onSizeChange = (event) => setCurrentFontSize(event.detail.size);
    const onFamilyChange = (event) => setCurrentFontFamily(event.detail.family);

    window.addEventListener('fontsizechange', onSizeChange);
    window.addEventListener('fontfamilychange', onFamilyChange);
    return () => {
      window.removeEventListener('fontsizechange', onSizeChange);
      window.removeEventListener('fontfamilychange', onFamilyChange);
    };
  }, []);

  const handleReset = () => {
    resetFontSettings();
    setCurrentFontSize(FONT_SIZES.md);
    setCurrentFontFamily(FONT_FAMILIES.default);
  };

  return (
    <div className="rounded-[2rem] border border-[var(--glass-border)] bg-[var(--bg-secondary)]/35 p-4 md:p-5 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent)]/10 text-[var(--accent)]">
            <span className="text-base font-bold leading-none select-none">Aa</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold tracking-tight text-[var(--text-primary)]">Typography</p>
            <p className="text-[11px] font-semibold leading-snug text-[var(--text-secondary)] opacity-70">
              Font size and style apply across the app. Default font is Poppins.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-3 py-2 text-[10px] font-semibold text-[var(--text-secondary)] transition hover:border-[var(--accent)]/30 hover:text-[var(--accent)]"
        >
          <RefreshCw className="size-3.5" />
          Reset
        </button>
      </div>

      <div>
        <p className="mb-3 text-[10px] font-black uppercase tracking-[0.15em] text-[var(--text-secondary)]">Font Size</p>
        <div className="grid grid-cols-4 gap-2">
          {SIZE_OPTIONS.map(({ key, label, short, sample, default: isDefault }) => (
            <button
              key={key}
              type="button"
              id={`font-size-${key}`}
              onClick={() => {
                setFontSize(key);
                setCurrentFontSize(key);
              }}
              className={`relative flex flex-col items-center justify-center gap-1.5 rounded-2xl border py-3 px-1 transition-all duration-200 ${
                currentFontSize === key
                  ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)] shadow-sm shadow-[var(--accent)]/10'
                  : 'border-[var(--glass-border)] bg-[var(--bg-secondary)]/30 text-[var(--text-secondary)] hover:border-[var(--accent)]/40 hover:text-[var(--accent)]'
              }`}
              aria-label={`Font size ${label}`}
              aria-pressed={currentFontSize === key}
            >
              {isDefault && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-[var(--accent)] px-1.5 py-px text-[7px] font-bold uppercase tracking-wide text-white whitespace-nowrap">
                  Default
                </span>
              )}
              <span className={`font-bold leading-none ${sample}`}>{short}</span>
              <span className="text-[9px] font-semibold tracking-wide opacity-70 leading-none">{label}</span>
            </button>
          ))}
        </div>
        <div className="mt-2 flex justify-between px-1 text-[10px] font-medium text-[var(--text-secondary)] opacity-60">
          <span>14px</span>
          <span>16px</span>
          <span>18px</span>
          <span>20px</span>
        </div>
      </div>

      <div>
        <p className="mb-3 text-[10px] font-black uppercase tracking-[0.15em] text-[var(--text-secondary)]">Font Style</p>
        <div className="grid grid-cols-2 gap-2">
          {FAMILY_OPTIONS.map(({ key, label, description }) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setFontFamily(key);
                setCurrentFontFamily(key);
              }}
              className={`flex flex-col items-start rounded-2xl border p-3 text-left transition-all ${
                currentFontFamily === key
                  ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)] shadow-sm shadow-[var(--accent)]/10'
                  : 'border-[var(--glass-border)] bg-[var(--bg-secondary)]/30 text-[var(--text-secondary)] hover:border-[var(--accent)]/40 hover:text-[var(--accent)]'
              }`}
              aria-pressed={currentFontFamily === key}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span className="text-[12px] font-semibold">{label}</span>
                {currentFontFamily === key && <Check className="size-3.5 shrink-0" />}
              </div>
              <span className="mt-1 text-[10px] opacity-70">{description}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[10px] font-black uppercase tracking-[0.15em] text-[var(--text-secondary)]">Preview</p>
        <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/70 p-4">
          <p className="text-sm leading-relaxed text-[var(--text-primary)]">
            The quick brown fox jumps over the lazy dog.
          </p>
          <p className="mt-2 text-[11px] leading-relaxed text-[var(--text-secondary)]">
            Auradime marketplace — browse products, stories, and wallet balance with your chosen typography.
          </p>
        </div>
      </div>
    </div>
  );
}
