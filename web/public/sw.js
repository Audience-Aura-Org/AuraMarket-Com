/**
 * Aura Market — PWA Service Worker v6
 * Robust background push handling with redundant notification suppression.
 */

const CACHE_NAME = 'aura-cache-v8'; // Bumped: improved notification display
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// ── Install: Cache static shell assets ─────────────────────────────────────────
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

// ── Message: Handle SKIP_WAITING ──────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── Activate: Cleanup ────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: Strategy ─────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/socket.io') ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      // Return cached, but try to fetch in background if not found
      return cached || fetch(event.request).catch(() => null);
    })
  );
});

// ── Push Notifications ───────────────────────────────────────────────────────
self.addEventListener('push', function (event) {
  if (!event.data) return;

  let data = {};
  try {
    data = event.data.json();
  } catch (e) {
    data = { title: 'Aura Market', body: event.data.text() };
  }

  const baseUrl = self.location.origin;

  // Icon: use sender avatar if provided (chat), else app logo
  const iconRaw = data.icon || '/logo-white.png';
  const icon = iconRaw.startsWith('http') ? iconRaw : baseUrl + iconRaw;
  const badge = baseUrl + '/logo-white.png';

  // Large image preview (e.g. sender avatar or product photo)
  const image = data.image ? (data.image.startsWith('http') ? data.image : baseUrl + data.image) : undefined;

  const isChat = data.tag && data.tag.startsWith('msg-');

  const options = {
    body: data.body || data.message || '',
    icon,
    badge,
    image,
    vibrate: isChat ? [100, 50, 100] : [200, 100, 200],
    tag: data.tag || 'aura-notification',
    renotify: true,
    requireInteraction: !isChat,   // chat: auto-dismiss; alerts: stay until tapped
    silent: false,
    // Store the full payload so notificationclick can forward rich data to the client
    data: {
      url: data.data?.url || data.url || '/',
      payload: data
    },
    actions: isChat
      ? [
          { action: 'open',  title: 'Reply' },
          { action: 'close', title: 'Dismiss' }
        ]
      : [
          { action: 'open',  title: 'View' },
          { action: 'close', title: 'Dismiss' }
        ]
  };

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      const isFocused = clientList.some(client => client.focused);
      if (isFocused) {
        console.log('[SW] App focused — suppressing OS push for in-app toast.');
        return null;
      }
      return self.registration.showNotification(data.title || 'Aura Market', options);
    })
  );
});

// ── Notification Click ────────────────────────────────────────────────────────
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  if (event.action === 'close') return;

  let urlToOpen = event.notification.data?.url || '/';
  
  // Ensure we have an absolute URL for reliable cross-device opening
  if (!urlToOpen.startsWith('http')) {
    urlToOpen = self.location.origin + (urlToOpen.startsWith('/') ? '' : '/') + urlToOpen;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windowClients) {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
          // Send message to client with the notification payload so the page can handle opening chat
          try {
            client.postMessage({ type: 'notification-click', payload: event.notification.data?.payload || {} });
          } catch (e) {
            // ignore
          }
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
