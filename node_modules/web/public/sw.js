/**
 * Aura Market — PWA Service Worker v6
 * Robust background push handling with redundant notification suppression.
 */

const CACHE_NAME = 'aura-cache-v6'; // Bumped version
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/logo-white.png',
  '/logo-black.png'
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
  const icon = data.icon ? (data.icon.startsWith('http') ? data.icon : baseUrl + data.icon) : baseUrl + '/logo-white.png';
  const badge = data.badge ? (data.badge.startsWith('http') ? data.badge : baseUrl + data.badge) : baseUrl + '/logo-white.png';

  const options = {
    body: data.body || data.message || '',
    icon: icon,
    badge: badge,
    vibrate: [200, 100, 200],
    tag: data.tag || 'aura-notification',
    renotify: true,
    requireInteraction: true,
    data: {
      url: data.data?.url || (data.url || '/')
    },
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'close', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      // DOUBLE NOTIFICATION GUARD
      const isFocused = clientList.some(client => client.focused);
      if (isFocused) {
        console.log('[SW v6] App focused. Suppressing system push for in-app toast.');
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

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windowClients) {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
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
