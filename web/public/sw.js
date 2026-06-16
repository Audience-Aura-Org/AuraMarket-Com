/**
 * Auradime — PWA Service Worker v8
 * Robust background push handling with redundant notification suppression.
 * Fix: RSC / prefetch requests are never intercepted (prevents 404 on dynamic routes).
 * Fix: Asset fallback never returns null to respondWith() (prevents Response TypeError).
 */

const CACHE_NAME = 'aura-cache-v10';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// ── Install: Cache static shell assets ──────────────────────────────────────
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

// ── Message: Handle SKIP_WAITING ────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── Activate: Cleanup old caches ────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

function normalizeNotificationUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '/notifications';

  try {
    const url = new URL(rawUrl, self.location.origin);
    if (url.origin !== self.location.origin) return url.href;
    let path = `${url.pathname}${url.search}${url.hash}`;

    if (/^\/vendor\/orders\/[^/?#]+/.test(path)) {
      const orderId = path.split('/')[3]?.split(/[?#]/)[0];
      path = orderId ? `/vendor/orders?orderId=${encodeURIComponent(orderId)}` : '/vendor/orders';
    }

    if (/^\/logistics\/dashboard\?shipmentId=/.test(path)) {
      path = path.replace('/logistics/dashboard', '/logistics/manifests');
    }

    if (/^\/logistics\/(shipments|tracking)\/[^/?#]+/.test(path)) {
      const shipmentId = path.split('/')[3]?.split(/[?#]/)[0];
      path = shipmentId ? `/logistics/manifests?shipmentId=${encodeURIComponent(shipmentId)}` : '/logistics/manifests';
    }

    if (path === '/logistics/dashboard' || path === '/logistics') return '/logistics/manifests';
    return path;
  } catch {
    return rawUrl;
  }
}

// ── Fetch: Network-first for nav, cache-first for assets ────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // ── Never intercept non-GET, API calls, Next internals, or socket traffic ──
  if (
    event.request.method !== 'GET' ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/_next/') ||
    url.pathname.startsWith('/socket.io')
  ) {
    return;
  }

  // ── Never intercept Next.js RSC / prefetch / router-state requests ──────────
  // These carry special headers/params that must reach the Next server unchanged.
  // Intercepting them corrupts navigation to dynamic routes (e.g. /vendor/products/edit/[id]).
  if (
    url.searchParams.has('_rsc') ||
    event.request.headers.get('RSC') === '1' ||
    event.request.headers.get('Next-Router-Prefetch') === '1' ||
    event.request.headers.get('Next-Router-State-Tree')
  ) {
    return;
  }

  // ── Navigation: network-first, fall back to cached shell ────────────────────
  if (
    event.request.mode === 'navigate' ||
    event.request.headers.get('accept')?.includes('text/html')
  ) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).catch(() =>
        caches.match('/').then((cached) =>
          cached || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } })
        )
      )
    );
    return;
  }

  // ── Static assets: cache-first, network fallback, never null ────────────────
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).catch(() =>
        new Response('Asset unavailable offline', {
          status: 503,
          headers: { 'Content-Type': 'text/plain' },
        })
      );
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
    data = { title: 'Auradime', body: event.data.text() };
  }

  const baseUrl = self.location.origin;

  // Icon: sender avatar for chat, app logo for everything else
  const iconRaw = data.icon || '/logo-white.png';
  const icon = iconRaw.startsWith('http') ? iconRaw : baseUrl + iconRaw;
  const badge = baseUrl + '/logo-white.png';

  // Large image preview (sender avatar or product photo)
  const image = data.image
    ? (data.image.startsWith('http') ? data.image : baseUrl + data.image)
    : undefined;

  const isChat = !!(data.tag && data.tag.startsWith('msg-'));

  const options = {
    body: data.body || data.message || '',
    icon,
    badge,
    image,
    vibrate: isChat ? [100, 50, 100] : [200, 100, 200],
    tag: data.tag || 'auradime-notification',
    renotify: true,
    requireInteraction: !isChat,
    silent: false,
    data: {
      url: data.data?.url || data.url || '/',
      payload: data
    },
    actions: isChat
      ? [
          { action: 'open',  title: 'Reply'   },
          { action: 'close', title: 'Dismiss' }
        ]
      : [
          { action: 'open',  title: 'View'    },
          { action: 'close', title: 'Dismiss' }
        ]
  };

  const showOrForward = async () => {
    const windowClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const visibleClients = windowClients.filter((client) => client.visibilityState === 'visible');

    if (visibleClients.length > 0) {
      visibleClients.forEach((client) => {
        try {
          client.postMessage({ type: 'push-received', payload: data });
        } catch (e) {
          // Ignore failures for individual clients
        }
      });
      return;
    }

    await self.registration.showNotification(data.title || 'Auradime', options);
  };

  event.waitUntil(showOrForward());
});

// ── Notification Click ───────────────────────────────────────────────────────
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  if (event.action === 'close') return;

  let urlToOpen = normalizeNotificationUrl(event.notification.data?.url || '/notifications');

  // Ensure absolute URL for reliable cross-device opening
  if (!urlToOpen.startsWith('http')) {
    urlToOpen = self.location.origin + (urlToOpen.startsWith('/') ? '' : '/') + urlToOpen;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus an existing tab of this origin if one is open
      for (const client of windowClients) {
        if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
          try {
            client.postMessage({
              type: 'notification-click',
              url: urlToOpen,
              payload: event.notification.data?.payload || {}
            });
          } catch (e) {
            console.error('[SW] postMessage failed:', e);
          }
          return client.focus().then(() => {
            if ('navigate' in client) return client.navigate(urlToOpen);
            return undefined;
          }).catch(() => undefined);
        }
      }
      // No open tab — open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
