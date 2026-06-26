const FONT_SIZES = {
  sm: 'sm',
  md: 'md',
  lg: 'lg',
  xl: 'xl'
};

const FONT_FAMILIES = {
  default: 'default',
  serif: 'serif',
  mono: 'mono',
  dyslexic: 'dyslexic'
};

const DEFAULT_SETTINGS = {
  fontSize: FONT_SIZES.md,
  fontFamily: FONT_FAMILIES.default
};

export function setFontSize(size) {
  if (typeof window === 'undefined') return;
  const nextSize = Object.values(FONT_SIZES).includes(size) ? size : FONT_SIZES.md;
  document.documentElement.setAttribute('data-font-size', nextSize);
  localStorage.setItem('auradime-font-size', nextSize);
  window.dispatchEvent(new CustomEvent('fontsizechange', { detail: { size: nextSize } }));
}

export function setFontFamily(family) {
  if (typeof window === 'undefined') return;
  const nextFamily = Object.values(FONT_FAMILIES).includes(family) ? family : FONT_FAMILIES.default;
  document.documentElement.setAttribute('data-font', nextFamily);
  localStorage.setItem('auradime-font', nextFamily);
  window.dispatchEvent(new CustomEvent('fontfamilychange', { detail: { family: nextFamily } }));
}

export function getFontSize() {
  if (typeof window === 'undefined') return FONT_SIZES.md;
  return document.documentElement.getAttribute('data-font-size') ||
    localStorage.getItem('auradime-font-size') ||
    FONT_SIZES.md;
}

export function getFontFamily() {
  if (typeof window === 'undefined') return FONT_FAMILIES.default;
  return document.documentElement.getAttribute('data-font') ||
    localStorage.getItem('auradime-font') ||
    FONT_FAMILIES.default;
}

export function resetFontSettings() {
  setFontSize(FONT_SIZES.md);
  setFontFamily(FONT_FAMILIES.default);
}

export function initFontSettings() {
  if (typeof window === 'undefined') return;
  setFontSize(localStorage.getItem('auradime-font-size') || FONT_SIZES.md);
  setFontFamily(localStorage.getItem('auradime-font') || FONT_FAMILIES.default);
}

export function getAvailableFontSizes() {
  return Object.values(FONT_SIZES);
}

export function getAvailableFontFamilies() {
  return Object.values(FONT_FAMILIES);
}

export { FONT_SIZES, FONT_FAMILIES, DEFAULT_SETTINGS };
