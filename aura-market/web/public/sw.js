/**
 * Aura Market — PWA Service Worker
 * Handles background push notifications even when the tab is closed.
 */

self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: data.icon || '/logo-white.png',
      badge: data.badge || '/apple-touch-icon.png',
      vibrate: [100, 50, 100],
      data: {
        url: data.data?.url || '/'
      },
      actions: [
        { action: 'open', title: 'Open Aura' },
        { action: 'close', title: 'Close' }
      ]
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  if (event.action === 'close') return;

  const urlToOpen = event.notification.data.url;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(windowClients) {
      for (let i = 0; i < windowClients.length; i++) {
        let client = windowClients[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Cache assets for offline view (Basic PWA behavior)
const CACHE_NAME = 'aura-cache-v1';
const ASSETS = [
  '/',
  '/manifest.json',
  '/logo-white.png',
  '/logo-black.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => response || fetch(event.request))
  );
});
