# Complete Chat Keyboard Fix

This file tracks the current mobile chat keyboard fix and what to inspect if a static gap remains between the composer and the keyboard.

## Diagnosis First

Connect the phone by USB, open `chrome://inspect` on desktop, inspect the PWA/WebView, then paste this in the console while the chat is open:

```js
console.log({
  vvHeight: window.visualViewport?.height,
  innerHeight: window.innerHeight,
  screenHeight: window.screen.height,
  screenAvailHeight: window.screen.availHeight,
  bodyPaddingBottom: getComputedStyle(document.body).paddingBottom,
  bodyMarginBottom: getComputedStyle(document.body).marginBottom,
  htmlPaddingBottom: getComputedStyle(document.documentElement).paddingBottom,
  chatRootHeight: document.getElementById('chat-root')?.style.height,
  composerPaddingBottom: document.querySelector('[data-chat-composer]')?.style.paddingBottom,
});
```

What to check:

- `vvHeight === innerHeight` when the keyboard is closed.
- `bodyPaddingBottom` and `bodyMarginBottom` are both `0px`.
- `composerPaddingBottom` is `0px`.
- `chatRootHeight` equals the visible viewport height.

If `vvHeight` is smaller than `innerHeight` before the keyboard opens, the browser chrome or Android navigation area is already reducing the visual viewport. If the gap is the same size as the browser bottom bar, test the installed PWA/Capacitor app rather than a normal browser tab.

## Current Code

### `web/app/chat/page.js`

The page wrapper is fixed and does not set a competing height:

```jsx
<div style={{ position: 'fixed', inset: 0, overflow: 'hidden' }}>
  <MessagingHub
    vendorId={vendorId}
    fullPage={true}
    onClose={() => router.push(chatExitHref(user?.role))}
  />
</div>
```

### `web/components/hub/MessagingHub.js`

Viewport state is initialized synchronously so the first render never has a missing height:

```js
const getInitialViewportHeight = () => {
  if (typeof window === 'undefined') return { height: 800, offsetTop: 0 };
  const viewport = window.visualViewport;
  return {
    height: viewport ? viewport.height : window.innerHeight,
    offsetTop: viewport ? viewport.offsetTop : 0,
  };
};

const [viewportHeight, setViewportHeight] = useState(getInitialViewportHeight);
```

The viewport sync updates React state. Framer Motion then applies the styles through its own `style` prop:

```js
const syncViewport = () => {
  const vv = window.visualViewport;
  const height = vv ? vv.height : window.innerHeight;
  const offsetTop = vv ? vv.offsetTop : 0;
  const isMobileChat = mobileQuery?.matches ?? window.innerWidth < 768;

  if (!isMobileChat) {
    setViewportHeight(null);
    return;
  }

  setViewportHeight({ height, offsetTop });

  if (activePartnerIdRef.current) {
    requestAnimationFrame(() => pinToLatestMessage('auto'));
    queuePinToLatest([80, 180, 320, 520]);
  }
};
```

The mobile root style always includes height, max height, and transform:

```js
const mobileShellStyle = mobileLayout
  ? {
      paddingTop: 'env(safe-area-inset-top, 0px)',
      position: 'fixed',
      top: 0,
      left: 0,
      bottom: 'auto',
      width: '100%',
      overflow: 'hidden',
      height: `${viewportHeight?.height ?? 800}px`,
      maxHeight: `${viewportHeight?.height ?? 800}px`,
      transform: `translateY(${viewportHeight?.offsetTop ?? 0}px)`,
    }
  : undefined;
```

The composer currently has no bottom padding so a nonzero Android safe-area inset cannot create a static gap:

```jsx
<div
  data-chat-composer
  className="shrink-0 border-t border-[var(--glass-border)] bg-[var(--bg-secondary)]/95 backdrop-blur-sm"
  style={{ paddingBottom: '0px' }}
>
```

### `web/styles/globals.css`

The body is not fixed while chat is open. `#chat-root` owns sizing:

```css
html.chat-open,
html.chat-open body {
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
  overscroll-behavior: none !important;
}

html.chat-open #chat-root {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  width: 100% !important;
  overflow: hidden !important;
}
```

## If A Gap Still Remains

- If `composerPaddingBottom` is not `0px`, inspect parent wrappers around `[data-chat-composer]`.
- If `bodyPaddingBottom` or `bodyMarginBottom` is nonzero, another global layout rule is active.
- If `chatRootHeight` does not match `vvHeight`, `mobileLayout` may not be true on that device width.
- If the visible gap matches the browser bottom toolbar, test installed PWA or Capacitor. Browser chrome is outside app CSS.
