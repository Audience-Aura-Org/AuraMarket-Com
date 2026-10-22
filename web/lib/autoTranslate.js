/**
 * DOM auto-translation helpers used by LanguageContext's MutationObserver.
 */

const OPT_OUT = '[translate="no"], .notranslate, [data-no-translate], [data-aura-no-translate]';

export const shouldTranslateNodeParent = (parent) => {
  if (!parent || parent.nodeType !== 1) return false;
  const tag = parent.tagName?.toLowerCase();
  if (['script', 'style', 'textarea', 'code', 'pre', 'noscript'].includes(tag)) return false;
  return !parent.closest(OPT_OUT);
};

export const shouldTranslateElement = (element) => {
  if (!element || element.nodeType !== 1) return false;
  const tag = element.tagName?.toLowerCase();
  if (['script', 'style', 'code', 'pre', 'noscript'].includes(tag)) return false;
  return !element.closest(OPT_OUT);
};

export const preserveOuterSpacing = (text, translated) => {
  const leading = text.match(/^\s*/)?.[0] || '';
  const trailing = text.match(/\s*$/)?.[0] || '';
  return `${leading}${translated}${trailing}`;
};

/**
 * Each node remembers its source text and the text this module last wrote.
 * Any other value means the app (React) changed it, so that value becomes
 * the new source — never revert app updates.
 */
export function translateTextNode(node, textMap) {
  if (!shouldTranslateNodeParent(node.parentElement)) return;
  const current = node.nodeValue;
  if (node.__auraOriginalText === undefined
      || (current !== node.__auraOriginalText && current !== node.__auraTranslatedText)) {
    node.__auraOriginalText = current;
    node.__auraTranslatedText = undefined;
  }
  const original = node.__auraOriginalText;

  const translated = textMap?.[String(original || '').trim()];
  const next = translated ? preserveOuterSpacing(original, translated) : original;
  node.__auraTranslatedText = translated ? next : undefined;
  if (current !== next) node.nodeValue = next;
}

export function translateAttributes(element, attributeMap) {
  if (!element || element.nodeType !== 1) return;
  if (!shouldTranslateElement(element)) return;

  ['placeholder', 'title', 'aria-label'].forEach((attribute) => {
    if (!element.hasAttribute(attribute)) return;
    const originalKey = `data-aura-original-${attribute}`;
    const translatedKey = `data-aura-translated-${attribute}`;
    const current = element.getAttribute(attribute);
    if (!element.hasAttribute(originalKey)
        || (current !== element.getAttribute(originalKey) && current !== element.getAttribute(translatedKey))) {
      element.setAttribute(originalKey, current);
      element.removeAttribute(translatedKey);
    }
    const original = element.getAttribute(originalKey);

    const translated = attributeMap?.[String(original || '').trim()];
    const next = translated || original;
    if (translated) element.setAttribute(translatedKey, translated);
    else element.removeAttribute(translatedKey);
    if (current !== next) element.setAttribute(attribute, next);
  });
}
