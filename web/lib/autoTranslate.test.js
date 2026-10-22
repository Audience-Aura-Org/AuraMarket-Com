import { describe, it, expect } from 'vitest';
import { translateTextNode, translateAttributes } from './autoTranslate';

const FR = { Accounts: 'Comptes', 'Save note': 'Enregistrer la note' };
const FR_ATTR = { 'Search accounts': 'Rechercher des comptes' };

const textIn = (value) => {
  const el = document.createElement('p');
  el.textContent = value;
  document.body.appendChild(el);
  return el.firstChild;
};

describe('translateTextNode', () => {
  it('does not revert text the app changed after the first scan (English)', () => {
    const node = textIn('0');
    translateTextNode(node, null); // first scan caches "0"
    node.nodeValue = '6';          // React updates the count
    translateTextNode(node, null); // observer-triggered rescan
    expect(node.nodeValue).toBe('6');
  });

  it('translates mapped text in French', () => {
    const node = textIn(' Accounts ');
    translateTextNode(node, FR);
    expect(node.nodeValue).toBe(' Comptes ');
  });

  it('keeps an app update to unmapped text while in French', () => {
    const node = textIn('Accounts');
    translateTextNode(node, FR);
    node.nodeValue = '4 accounts need you today';
    translateTextNode(node, FR);
    expect(node.nodeValue).toBe('4 accounts need you today');
  });

  it('translates an app update that has a mapping', () => {
    const node = textIn('Accounts');
    translateTextNode(node, FR);
    node.nodeValue = 'Save note';
    translateTextNode(node, FR);
    expect(node.nodeValue).toBe('Enregistrer la note');
  });

  it('restores the original text when switching back to English', () => {
    const node = textIn('Accounts');
    translateTextNode(node, FR);
    translateTextNode(node, null);
    expect(node.nodeValue).toBe('Accounts');
  });

  it('skips text inside opted-out elements', () => {
    const el = document.createElement('code');
    el.textContent = 'Accounts';
    document.body.appendChild(el);
    translateTextNode(el.firstChild, FR);
    expect(el.textContent).toBe('Accounts');
  });
});

describe('translateAttributes', () => {
  it('does not revert an attribute the app changed (English)', () => {
    const el = document.createElement('button');
    el.setAttribute('title', 'All accounts');
    document.body.appendChild(el);
    translateAttributes(el, null);
    el.setAttribute('title', 'Mama Ngozi Kitchen'); // React re-renders the picker label
    translateAttributes(el, null);
    expect(el.getAttribute('title')).toBe('Mama Ngozi Kitchen');
  });

  it('translates and restores mapped attributes', () => {
    const el = document.createElement('input');
    el.setAttribute('placeholder', 'Search accounts');
    document.body.appendChild(el);
    translateAttributes(el, FR_ATTR);
    expect(el.getAttribute('placeholder')).toBe('Rechercher des comptes');
    translateAttributes(el, null);
    expect(el.getAttribute('placeholder')).toBe('Search accounts');
  });
});
