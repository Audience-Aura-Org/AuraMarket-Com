# Chat / PWA Debug Handoff

This is the relevant chat styling, PWA notification flow, and the likely causes of:

- chat layout behaving differently in Safari vs Chrome
- chat layout changing across device sizes
- tapping a message notification opens chat but the header temporarily shows `User`

## Main Files

- Frontend chat page: `web/app/chat/page.js`
- Chat UI and mobile viewport logic: `web/components/hub/MessagingHub.js`
- Chat global state/cache: `web/context/ChatContext.js`
- Global chat CSS: `web/styles/globals.css`
- Browser service worker: `web/public/sw.js`
- PWA registration/subscription: `web/lib/pwa-helper.js`
- Foreground notification and service-worker click handling: `web/components/SocketProvider.js`
- Native Android push click handling: `web/lib/native-push.js`
- Capacitor keyboard height hook: `web/hooks/useKeyboardHeight.js`
- Backend chat send/push fallback: `backend/controllers/chat.controller.js`
- Backend socket send/push path: `backend/sockets/chat.socket.js`
- Backend notification payload builder: `backend/utils/notifier.js`

## What Is Wrong

1. The chat uses global CSS `html { zoom: 0.7 }` and mobile `html { zoom: 0.8 }`.
   `zoom` is non-standard and behaves differently in Chrome, Safari, Android WebView, and PWA mode. The chat code compensates by dividing viewport height by computed `zoom`, but Chrome/PWA viewport values can still differ from Safari. This is a major reason layout works in Safari but not Chrome.

2. The chat height is controlled by JavaScript using `window.visualViewport.height`, `window.innerHeight`, `window.screen.height`, cached full height, and keyboard state. Chrome mobile changes `visualViewport` aggressively when the address bar collapses/expands or keyboard opens. Safari behaves differently, so the current thresholds can be wrong per device.

3. The mobile root is `position: fixed` and receives an inline pixel height:
   `height: ${viewportHeight?.height ?? 800}px`.
   This can be fragile across devices, especially with Chrome dynamic toolbars, Android navigation bars, PWA standalone mode, and the global `zoom`.

4. Notification click only navigates to `/chat?vendorId=<senderId>`.
   The actual sender name is not in the URL, and cold-open chat starts with only the ID. `MessagingHub` computes:
   `partnerName = partnerInfo?.store_name || partnerInfo?.branding?.store_name || partnerInfo?.name || 'User'`.
   Until partner info is loaded from cache, `/auth/users/:id`, or populated messages, the fallback is literally `User`.

5. Backend `GET /chat/:userId` returns messages without populating `sender_id` and `receiver_id`.
   That means the fallback in `MessagingHub.loadConversation()` often cannot derive the sender name from message objects.

6. Backend push payload includes sender id and URL but not a rich `senderData` object.
   `SocketProvider.handleNotificationIntent()` supports `senderData`, but `backend/utils/notifier.js` does not include it in the web push payload, and native FCM only gets primitive fields too.

7. There are encoding/mojibake artifacts in comments and some strings, for example `Auradime â€”` and emoji-like corrupted text. Mostly cosmetic, but it can leak into notification bodies if those strings are used.

## Relevant Chat CSS

From `web/styles/globals.css`:

```css
html {
  font-size: 16px;
  zoom: 0.7;
  min-height: 100%;
  height: 100%;
  -webkit-text-size-adjust: 100%;
  scroll-behavior: smooth;
  -webkit-tap-highlight-color: transparent;
  touch-action: pan-y;
}

body {
  min-height: 100%;
  height: 100%;
  min-height: 100vh;
  width: 100%;
  margin: 0;
  padding: 0;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
}

@media (max-width: 640px) {
  html {
    font-size: 14px;
    zoom: 0.8;
  }
  input, textarea, select { font-size: 16px !important; }
}

html.chat-open,
html.chat-open body {
  height: 100% !important;
  min-height: 100% !important;
  width: 100% !important;
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

.chat-bg-pattern {
  background-color: var(--bg-secondary);
  background-image:
    radial-gradient(circle at 18% 14%, color-mix(in srgb, var(--accent) 13%, transparent) 0 2px, transparent 2.5px),
    radial-gradient(circle at 80% 82%, color-mix(in srgb, var(--accent-light) 10%, transparent) 0 1.5px, transparent 2px),
    linear-gradient(135deg, color-mix(in srgb, var(--accent) 6%, transparent) 0 1px, transparent 1px 20px),
    radial-gradient(ellipse 120% 80% at 10% 0%, color-mix(in srgb, var(--accent) 14%, transparent) 0%, transparent 55%),
    radial-gradient(ellipse 100% 70% at 92% 100%, color-mix(in srgb, var(--accent-light) 12%, transparent) 0%, transparent 50%),
    linear-gradient(165deg, color-mix(in srgb, var(--bg-primary) 60%, transparent) 0%, transparent 42%);
  background-size: 34px 34px, 46px 46px, 20px 20px, auto, auto, auto;
}

.chat-scrollbar::-webkit-scrollbar { width: 5px; }
.chat-scrollbar::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--text-primary) 16%, transparent);
  border-radius: 10px;
}

#chat-root {
  contain: layout style paint;
  will-change: height, transform;
  backface-visibility: hidden;
  -webkit-font-smoothing: antialiased;
}

#chat-root [data-chat-messages] {
  contain: layout style paint;
  scrollbar-gutter: stable;
  will-change: transform;
  overflow-y: overlay;
}

#chat-root [data-chat-composer] {
  contain: layout style paint;
  position: relative;
}

#chat-root [data-chat-header] {
  contain: layout style;
}
```

## Relevant Chat Viewport Code

From `web/components/hub/MessagingHub.js`:

```js
const getChatViewportMetrics = () => {
  const viewport = window.visualViewport;
  const layoutHeight = window.innerHeight || document.documentElement?.clientHeight || 800;
  const visualHeight = viewport?.height || layoutHeight;
  const offsetTop = viewport?.offsetTop || 0;
  const keyboardOpen = Boolean(viewport && visualHeight < layoutHeight * 0.78);
  const zoomValue = Number.parseFloat(window.getComputedStyle(document.documentElement).zoom);
  const zoomScale = Number.isFinite(zoomValue) && zoomValue > 0 ? zoomValue : 1;
  const targetHeight = keyboardOpen ? visualHeight : Math.max(layoutHeight, visualHeight);

  return {
    height: targetHeight / zoomScale,
    offsetTop: keyboardOpen ? offsetTop / zoomScale : 0,
    keyboardOpen,
    zoomScale,
  };
};

const mobileShellStyle = mobileLayout
  ? {
      paddingTop: 'env(safe-area-inset-top, 0px)',
      position: 'fixed',
      top: 0,
      left: 0,
      bottom: 'auto',
      width: '100%',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'var(--bg-secondary)',
      height: `${viewportHeight?.height ?? 800}px`,
      maxHeight: `${viewportHeight?.height ?? 800}px`,
      transform: 'translateY(0px)',
    }
  : undefined;
```

## Relevant Chat Markup / Classes

Important class names from `web/components/hub/MessagingHub.js`:

```jsx
<motion.div
  id="chat-root"
  style={{ ...mobileShellStyle, contain: 'layout style paint' }}
  className="flex min-h-0 w-full flex-col overflow-hidden bg-[var(--bg-secondary)] touch-manipulation max-md:w-full md:h-full md:flex-1"
>
  <motion.div data-chat-header className="shrink-0 bg-[var(--nav-bg)] text-[var(--nav-text)] shadow-[0_1px_3px_rgba(0,0,0,0.15)]">
    ...
    <h3 className="truncate text-[14px] font-semibold leading-tight text-[var(--nav-text)] capitalize sm:text-[15px]">
      {partnerName}
    </h3>
  </motion.div>

  <div
    data-chat-messages
    className="min-h-0 flex-1 overflow-y-auto overscroll-contain chat-bg-pattern chat-scrollbar"
  >
    ...
    <div className={`flex w-full min-w-0 ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex min-w-0 max-w-[88%] flex-col gap-0.5 sm:max-w-[72%] lg:max-w-[68%]`}>
        <p className="whitespace-pre-wrap break-words text-[13px] [overflow-wrap:anywhere] sm:text-[14.5px]">
          {msg.text}
        </p>
      </div>
    </div>
  </div>

  <div data-chat-composer className="shrink-0 border-t border-[var(--glass-border)] bg-[var(--bg-secondary)]">
    <div className="mx-auto flex w-full max-w-4xl min-w-0 items-end gap-1.5 px-2 pb-1 pt-1.5 sm:gap-2 sm:px-3 sm:pb-1.5 sm:pt-2">
      <textarea className="max-h-[88px] min-h-[42px] w-full min-w-0 flex-1 resize-none overflow-y-auto bg-transparent px-3 py-2.5 text-[14px] leading-snug text-[var(--text-primary)] outline-none placeholder:text-[var(--text-secondary)]" />
    </div>
  </div>
</motion.div>
```

## Partner Name Logic

From `web/components/hub/MessagingHub.js`:

```js
const partnerInfo = activeConversation?.partner || initialData || null;
const partnerName = (
  partnerInfo?.store_name ||
  partnerInfo?.branding?.store_name ||
  partnerInfo?.name ||
  'User'
).toString();
```

This is why it shows `User`: the chat was opened with only `vendorId`, not a name-bearing partner object.

## Notification Click Flow

From `web/public/sw.js`:

```js
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  if (event.action === 'close') return;

  let urlToOpen = normalizeNotificationUrl(event.notification.data?.url || '/notifications');

  if (!urlToOpen.startsWith('http')) {
    urlToOpen = self.location.origin + (urlToOpen.startsWith('/') ? '' : '/') + urlToOpen;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
          client.postMessage({
            type: 'notification-click',
            url: urlToOpen,
            payload: event.notification.data?.payload || {}
          });
          return client.focus().then(() => {
            if ('navigate' in client) return client.navigate(urlToOpen);
          });
        }
      }
      if (clients.openWindow) return clients.openWindow(urlToOpen);
    })
  );
});
```

From `web/components/SocketProvider.js`:

```js
const handleNotificationIntent = async ({ route, payload = {}, senderId = null, senderData = null } = {}) => {
  const targetRoute = normalizeAppRoute(route || payload?.url);
  const resolvedSenderId =
    senderId ||
    payload.sender_id ||
    payload.senderId ||
    payload.userId ||
    payload.data?.sender_id ||
    payload.data?.senderId;

  let partnerId = resolvedSenderId;
  if (!partnerId && payload.tag?.startsWith('msg-')) {
    partnerId = payload.tag.split('-')[1];
  }

  const partnerPayload = senderData || payload.sender || payload.senderData || payload.data?.senderData || payload.data?.sender || {
    _id: partnerId,
    name: payload.title || payload.name || 'Auradime User',
    avatar: payload.icon || null,
    store_name: payload.store_name || payload.storeName,
  };

  if (partnerId) {
    openMessageRoute(partnerId, partnerPayload, targetRoute || `/chat?vendorId=${encodeURIComponent(partnerId)}`);
  }
};
```

## Backend Push Payload

From `backend/utils/notifier.js`:

```js
const payload = JSON.stringify({
  title: localizedTitle,
  body: localizedMessage,
  icon: iconUrl,
  image: (type === 'message' && senderAvatar) ? senderAvatar : undefined,
  tag: (type === 'message' && senderId) ? `msg-${senderId}` : `alert-${recipientId}-${Date.now()}`,
  data: {
    url: notificationUrl,
    sender_id: senderId,
    senderId: senderId,
    notification_id: notification._id.toString(),
    type
  },
  sender_id: senderId,
  senderId: senderId,
  notification_id: notification._id.toString(),
  type
});
```

Problem: this payload has `title`, `sender_id`, `senderId`, and URL, but it does not include a structured `senderData` object. The frontend supports `senderData`, but the backend does not send it.

## Recommended Fixes

1. Remove global `html { zoom: ... }` or do not use `zoom` for chat routes. Use normal `font-size`, `rem`, and responsive Tailwind instead. If you keep global zoom, isolate chat:

```css
html.chat-open {
  zoom: 1 !important;
}
```

Then remove the `/ zoomScale` compensation in chat viewport calculations.

2. Prefer CSS dynamic viewport units for the chat shell where possible:

```css
html.chat-open #chat-root {
  height: 100dvh;
  height: 100svh;
}
```

Use JavaScript only for keyboard edge cases, not as the default layout engine.

3. Populate users in `GET /chat/:userId`:

```js
const messages = await Message.find(...)
  .populate('sender_id', 'name avatar role branding store_name is_online last_seen')
  .populate('receiver_id', 'name avatar role branding store_name is_online last_seen')
  .populate('product_reference', PRODUCT_REFERENCE_SELECT)
  .sort({ createdAt: -1 })
  .skip((page - 1) * limit)
  .limit(limit)
  .lean();
```

4. Include `senderData` in backend notification payloads:

```js
metadata: {
  sender_id: req.user._id,
  senderData: {
    _id: req.user._id,
    name: req.user.branding?.store_name || req.user.name || 'Auradime User',
    avatar: req.user.avatar || req.user.branding?.logo || null,
    store_name: req.user.branding?.store_name || null,
    branding: req.user.branding || {},
  },
  link: `/chat?vendorId=${req.user._id}`,
}
```

Then in `notifier.js`, pass it into the payload:

```js
data: {
  url: notificationUrl,
  sender_id: senderId,
  senderId,
  senderData: metadata?.senderData || null,
  notification_id: notification._id.toString(),
  type,
},
senderData: metadata?.senderData || null,
```

5. In `web/app/chat/page.js`, optionally prefetch the user profile for `vendorId` and pass it to `MessagingHub` as `initialData`. That prevents the first paint from showing `User`.

6. Change the fallback text from `'User'` to `'Loading...'` or use the notification title while profile loads. This is not the real fix, but it avoids looking broken.

