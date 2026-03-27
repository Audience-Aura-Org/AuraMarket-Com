/**
 * Aura Market — PWA Service Worker v2
 * Handles background push notifications even when the tab is closed.
 */

const CACHE_NAME = 'aura-cache-v2'; // Bumped version — forces cache refresh on all clients
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/logo-white.png',
  '/logo-black.png'
];

// ── Install: Cache static shell assets ─────────────────────────────────────────
self.addEventListener('install', (event) => {
  // Skip waiting so the new SW activates immediately
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

// ── Activate: Delete old caches ──────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    ).then(() => {
      // Take control of all open clients immediately
      return self.clients.claim();
    })
  );
});

// ── Fetch: Network-first strategy ───────────────────────────────────────────
// API calls always go to network. Static assets use cache-first.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Always fetch API and socket calls from network — never cache
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/socket.io') ||
    event.request.method !== 'GET'
  ) {
    return; // Let browser handle it natively
  }

  // Cache-first for static assets, network fallback
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).catch(() => cached); // Graceful offline fallback
    })
  );
});

// ── Push Notifications ───────────────────────────────────────────────────────
self.addEventListener('push', function (event) {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch (e) {
    data = { title: 'Aura Market', body: event.data.text() };
  }

  const options = {
    body: data.body || data.message || '',
    icon: data.icon || '/logo-white.png',
    badge: data.badge || '/logo-white.png',
    vibrate: [100, 50, 100],
    tag: data.tag || 'aura-notification', // Prevents duplicate notifications
    renotify: true,
    data: {
      url: data.data?.url || '/'
    },
    actions: [
      { action: 'open', title: 'Open Aura' },
      { action: 'close', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Aura Market', options)
  );
});

// ── Notification Click ────────────────────────────────────────────────────────
self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  if (event.action === 'close') return;

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windowClients) {
      // Focus existing tab if open
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        const clientUrl = new URL(client.url);
        const targetUrl = new URL(urlToOpen, self.location.origin);
        if (clientUrl.origin === targetUrl.origin && 'focus' in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      // Open new tab
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
