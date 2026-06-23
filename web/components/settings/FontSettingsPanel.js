"use client";

import { useState, useEffect } from 'react';
import { Settings, Type, ZoomIn, ZoomOut, RefreshCw, Check } from 'lucide-react';
import { 
  setFontSize, 
  setFontFamily, 
  getFontSize, 
  getFontFamily,
  resetFontSettings,
  FONT_SIZES,
  FONT_FAMILIES
} from '@/utils/fontSettings';

/**
 * Font Settings Panel Component
 * Provides UI for users to customize font size and font family
 */
export default function FontSettingsPanel() {
  const [currentFontSize, setCurrentFontSize] = useState(FONT_SIZES.md);
  const [currentFontFamily, setCurrentFontFamily] = useState(FONT_FAMILIES.default);
  const [isOpen, setIsOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  // Initialize settings on component mount
  useEffect(() => {
    setCurrentFontSize(getFontSize());
    setCurrentFontFamily(getFontFamily());
  }, []);

  // Listen for font changes from other components
  useEffect(() => {
    const handleFontSizeChange = (event) => {
      setCurrentFontSize(event.detail.size);
    };

    const handleFontFamilyChange = (event) => {
      setCurrentFontFamily(event.detail.family);
    };

    window.addEventListener('fontsizechange', handleFontSizeChange);
    window.addEventListener('fontfamilychange', handleFontFamilyChange);

    return () => {
      window.removeEventListener('fontsizechange', handleFontSizeChange);
      window.removeEventListener('fontfamilychange', handleFontFamilyChange);
    };
  }, []);

  const handleFontSizeChange = (size) => {
    setFontSize(size);
    setCurrentFontSize(size);
  };

  const handleFontFamilyChange = (family) => {
    setFontFamily(family);
    setCurrentFontFamily(family);
  };

  const handleReset = () => {
    resetFontSettings();
    setCurrentFontSize(FONT_SIZES.md);
    setCurrentFontFamily(FONT_FAMILIES.default);
  };

  const fontSizeLabels = {
    [FONT_SIZES.sm]: { label: 'Small', icon: <ZoomOut className="size-3.5" /> },
    [FONT_SIZES.md]: { label: 'Medium', icon: <Type className="size-3.5" /> },
    [FONT_SIZES.lg]: { label: 'Large', icon: <ZoomIn className="size-3.5" /> },
    [FONT_SIZES.xl]: { label: 'Extra Large', icon: <ZoomIn className="size-4" /> },
  };

  const fontFamilyLabels = {
    [FONT_FAMILIES.default]: { label: 'Default', description: 'Clean, modern' },
    [FONT_FAMILIES.serif]: { label: 'Serif', description: 'Editorial, warm' },
    [FONT_FAMILIES.mono]: { label: 'Mono', description: 'Technical' },
    [FONT_FAMILIES.dyslexic]: { label: 'Dyslexic-friendly', description: 'Accessible' },
  };

  return (
    <>
      {/* Settings Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-24 right-4 z-50 flex size-12 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/30 hover:shadow-xl hover:shadow-[var(--accent)]/40 transition-all duration-300 lg:bottom-6 lg:right-6"
        aria-label="Open font settings"
        title="Font Settings"
      >
        <Settings className="size-5" />
      </button>

      {/* Settings Panel */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="relative mx-4 w-full max-w-md rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] shadow-2xl animate-in fade-in slide-in-from-bottom-4">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--glass-border)] p-5">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-[var(--accent)]/10 text-[var(--accent)]">
                  <Type className="size-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold tracking-tight">Typography Settings</h2>
                  <p className="text-[11px] text-[var(--text-secondary)] opacity-60">
                    Customize your reading experience
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="flex size-9 items-center justify-center rounded-lg border border-[var(--glass-border)] bg-[var(--bg-secondary)]/50 text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
                aria-label="Close settings"
              >
                ×
              </button>
            </div>

            {/* Content */}
            <div className="space-y-6 p-5">
              {/* Font Size Section */}
              <section>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-semibold tracking-tight">Font Size</h3>
                  <span className="text-[11px] text-[var(--text-secondary)] opacity-60">
                    Current: {fontSizeLabels[currentFontSize]?.label}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {Object.entries(FONT_SIZES).map(([key, size]) => (
                    <button
                      key={key}
                      onClick={() => handleFontSizeChange(size)}
                      className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border py-3 transition-all ${
                        currentFontSize === size
                          ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)] shadow-sm shadow-[var(--accent)]/10'
                          : 'border-[var(--glass-border)] bg-[var(--bg-secondary)]/30 text-[var(--text-secondary)] hover:border-[var(--accent)]/30 hover:text-[var(--accent)]'
                      }`}
                      aria-label={`Set font size to ${fontSizeLabels[size]?.label}`}
                    >
                      {fontSizeLabels[size]?.icon}
                      <span className="text-[10px] font-semibold uppercase tracking-wide">
                        {fontSizeLabels[size]?.label.charAt(0)}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between text-[10px] text-[var(--text-secondary)] opacity-60">
                  <span>14px</span>
                  <span>16px</span>
                  <span>18px</span>
                  <span>20px</span>
                </div>
              </section>

              {/* Font Family Section */}
              <section>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-semibold tracking-tight">Font Style</h3>
                  <span className="text-[11px] text-[var(--text-secondary)] opacity-60">
                    Current: {fontFamilyLabels[currentFontFamily]?.label}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(FONT_FAMILIES).map(([key, family]) => (
                    <button
                      key={key}
                      onClick={() => handleFontFamilyChange(family)}
                      className={`flex flex-col items-start rounded-xl border p-3 text-left transition-all ${
                        currentFontFamily === family
                          ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)] shadow-sm shadow-[var(--accent)]/10'
                          : 'border-[var(--glass-border)] bg-[var(--bg-secondary)]/30 text-[var(--text-secondary)] hover:border-[var(--accent)]/30 hover:text-[var(--accent)]'
                      }`}
                      aria-label={`Set font family to ${fontFamilyLabels[family]?.label}`}
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className="text-[12px] font-semibold">
                          {fontFamilyLabels[family]?.label}
                        </span>
                        {currentFontFamily === family && (
                          <Check className="size-3.5 text-[var(--accent)]" />
                        )}
                      </div>
                      <p className="mt-1 text-[10px] opacity-70">
                        {fontFamilyLabels[family]?.description}
                      </p>
                    </button>
                  ))}
                </div>
              </section>

              {/* Preview Section */}
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold tracking-tight">Preview</h3>
                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    className="text-[10px] text-[var(--text-secondary)] opacity-60 hover:text-[var(--accent)] transition-colors"
                  >
                    {showPreview ? 'Hide' : 'Show'}
                  </button>
                </div>
                {showPreview && (
                  <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/20 p-4">
                    <p className="text-sm leading-relaxed">
                      The quick brown fox jumps over the lazy dog. This sentence contains every letter in the alphabet.
                    </p>
                    <p className="mt-2 text-[11px] text-[var(--text-secondary)] opacity-70">
                      Adjust the settings above to see changes in real-time.
                    </p>
                  </div>
                )}
              </section>

              {/* Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-[var(--glass-border)]">
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 rounded-lg border border-[var(--glass-border)] bg-[var(--bg-secondary)]/30 px-4 py-2 text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
                >
                  <RefreshCw className="size-3.5" />
                  Reset to Defaults
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg bg-[var(--accent)] px-5 py-2 text-[11px] font-semibold text-white shadow-md shadow-[var(--accent)]/20 hover:shadow-lg transition-shadow"
                >
                  Apply & Close
                </button>
              </div>
            </div>

            {/* Current Settings Indicator */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <div className="rounded-full bg-[var(--accent)] px-3 py-1 text-[10px] font-semibold text-white shadow-md">
                {fontSizeLabels[currentFontSize]?.label} • {fontFamilyLabels[currentFontFamily]?.label}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}