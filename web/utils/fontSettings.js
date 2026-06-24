/**
 * Font Settings Utility for Auradime
 * Provides font size and font family customization
 */

// Font size presets
const FONT_SIZES = {
  sm: 'sm',
  md: 'md',
  lg: 'lg',
  xl: 'xl'
};

// Font family presets
const FONT_FAMILIES = {
  default: 'default',
  serif: 'serif',
  mono: 'mono',
  dyslexic: 'dyslexic'
};

// Default settings
const DEFAULT_SETTINGS = {
  fontSize: FONT_SIZES.md,
  fontFamily: FONT_FAMILIES.default
};

/**
 * Set font size preset
 * @param {string} size - One of 'sm', 'md', 'lg', 'xl'
 */
export function setFontSize(size) {
  if (typeof window === 'undefined') return;
  if (!Object.values(FONT_SIZES).includes(size)) {
    console.warn(`Invalid font size: ${size}. Using default 'md'.`);
    size = FONT_SIZES.md;
  }

  document.documentElement.setAttribute('data-font-size', size);
  localStorage.setItem('auradime-font-size', size);
  window.dispatchEvent(new CustomEvent('fontsizechange', { detail: { size } }));
}

export function setFontFamily(family) {
  if (typeof window === 'undefined') return;
  if (!Object.values(FONT_FAMILIES).includes(family)) {
    console.warn(`Invalid font family: ${family}. Using default.`);
    family = FONT_FAMILIES.default;
  }

  document.documentElement.setAttribute('data-font', family);
  localStorage.setItem('auradime-font', family);
  window.dispatchEvent(new CustomEvent('fontfamilychange', { detail: { family } }));
}

/**
 * Get current font size
 * @returns {string} Current font size preset
 */
export function getFontSize() {
  return document.documentElement.getAttribute('data-font-size') || 
         localStorage.getItem('auradime-font-size') || 
         FONT_SIZES.md;
}

/**
 * Get current font family
 * @returns {string} Current font family preset
 */
export function getFontFamily() {
  return document.documentElement.getAttribute('data-font') || 
         localStorage.getItem('auradime-font') || 
         FONT_FAMILIES.default;
}

/**
 * Reset all font settings to defaults
 */
export function resetFontSettings() {
  setFontSize(FONT_SIZES.md);
  setFontFamily(FONT_FAMILIES.default);
}

/**
 * Initialize font settings on app load
 * Restores saved preferences from localStorage
 */
export function initFontSettings() {
  if (typeof window === 'undefined') return;
  const savedSize = localStorage.getItem('auradime-font-size');
  if (savedSize && Object.values(FONT_SIZES).includes(savedSize)) {
    setFontSize(savedSize);
  } else {
    setFontSize(FONT_SIZES.md);
  }

  const savedFamily = localStorage.getItem('auradime-font');
  if (savedFamily && Object.values(FONT_FAMILIES).includes(savedFamily)) {
    setFontFamily(savedFamily);
  } else {
    setFontFamily(FONT_FAMILIES.default);
  }
}

/**
 * Check if a font size is available
 * @param {string} size - Font size to check
 * @returns {boolean} True if available
 */
export function isFontSizeAvailable(size) {
  return Object.values(FONT_SIZES).includes(size);
}

/**
 * Check if a font family is available
 * @param {string} family - Font family to check
 * @returns {boolean} True if available
 */
export function isFontFamilyAvailable(family) {
  return Object.values(FONT_FAMILIES).includes(family);
}

/**
 * Get all available font sizes
 * @returns {string[]} Array of available font sizes
 */
export function getAvailableFontSizes() {
  return Object.values(FONT_SIZES);
}

/**
 * Get all available font families
 * @returns {string[]} Array of available font families
 */
export function getAvailableFontFamilies() {
  return Object.values(FONT_FAMILIES);
}

// Export constants for direct use
export { FONT_SIZES, FONT_FAMILIES, DEFAULT_SETTINGS };