/**
 * Auradime — PWA Service Worker v10
 * Offline-first (WhatsApp-style): users see last-known content when offline.
 *
 * Strategy summary:
 *  Navigation pages    → stale-while-revalidate  (show cache, refresh in bg)
 *  /_next/static/*     → cache-first             (content-hashed, immutable)
 *  api.auradime.com    → network-first + cache   (fresh when online, cached when not)
 *  CDN images / media  → stale-while-revalidate  (instant load, refresh in bg)
 *  Google Fonts        → cache-first
 *  Push notifications  → unchanged
 */

const CACHE_NAME       = 'aura-cache-v12';
const MEDIA_CACHE_NAME = 'aura-media-v1';
const API_CACHE_NAME   = 'aura-api-v1';
const VIDEO_CACHE_NAME = 'aura-video-v1';   // status video files (offline playback)
const MEDIA_CACHE_MAX  = 250;
const API_CACHE_MAX    = 300;
const VIDEO_CACHE_MAX  = 8;                  // keep last 8 videos (≤ 15 MB each)
const VIDEO_MAX_BYTES  = 15 * 1024 * 1024;  // skip caching videos larger than 15 MB

// Core shell pages — pre-cached on install so they open offline immediately.
const SHELL_PAGES = [
  '/',
  '/offline',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/shop',
  '/status',
  '/discovery',
  '/discovery/hub',
  '/notifications',
  '/login',
  '/signup',
  '/orders',
  '/messages',
  '/cart',
  '/profile',
  '/wallet',
];

// ── Install: pre-cache shell pages ──────────────────────────────────────────
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // allSettled — one slow/missing page never blocks the whole install.
      Promise.allSettled(SHELL_PAGES.map((url) => cache.add(url).catch(() => {})))
    )
  );
});

// ── Message: handle SKIP_WAITING ────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── Activate: clean up old caches ───────────────────────────────────────────
self.addEventListener('activate', (event) => {
  const keepCaches = new Set([
    CACHE_NAME, MEDIA_CACHE_NAME, API_CACHE_NAME, VIDEO_CACHE_NAME, 'aura-google-fonts',
  ]);
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !keepCaches.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ── Helpers ──────────────────────────────────────────────────────────────────
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

// Cacheable image media (skip videos — too large).
function isCacheableMedia(url) {
  if (url.pathname.startsWith('/uploads/')) return true;
  return /\.(jpe?g|png|webp|avif|gif)(\?|$)/i.test(url.pathname + url.search);
}

// api.auradime.com GET paths that are safe to serve stale when offline.
// Excludes auth, payments, mutations, real-time and upload paths.
function isCacheableApiPath(url) {
  if (url.hostname !== 'api.auradime.com') return false;
  const p = url.pathname;
  if (
    p.includes('/auth/') ||
    p.includes('/upload') ||
    p.includes('/socket') ||
    p.includes('/payment') ||
    p.includes('/payout') ||
    p.includes('/wallet/withdraw') ||
    p.includes('/wallet/transfer') ||
    p.includes('/presign') ||
    p.includes('/process-s3')
  ) return false;
  return (
    p.includes('/statuses') ||
    p.includes('/products') ||
    p.includes('/categories') ||
    p.includes('/homepage') ||
    p.includes('/discovery') ||
    p.includes('/stores') ||
    p.includes('/brands') ||
    p.includes('/reviews') ||
    p.includes('/subscriptions/plans') ||
    p.includes('/orders') ||
    p.includes('/notifications') ||
    p.includes('/cart')
  );
}

// Status video files — mp4/webm/mov from CDN (NOT images).
function isCacheableVideo(url) {
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url.pathname + url.search);
}

// Serve a byte-range slice from a cached ArrayBuffer (for <video> seek support).
function serveRange(buffer, rangeHeader, contentType) {
  const total = buffer.byteLength;
  const match = (rangeHeader || '').match(/bytes=(\d*)-(\d*)/);
  if (!match) {
    return new Response(buffer, {
      status: 200,
      headers: { 'Content-Type': contentType, 'Content-Length': String(total), 'Accept-Ranges': 'bytes' },
    });
  }
  const start = match[1] ? parseInt(match[1], 10) : 0;
  const end   = match[2] ? Math.min(parseInt(match[2], 10), total - 1) : total - 1;
  return new Response(buffer.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type':  contentType,
      'Content-Range': `bytes ${start}-${end}/${total}`,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes',
    },
  });
}

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // ── 1. Google Fonts — cache-first ─────────────────────────────────────────
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open('aura-google-fonts').then((cache) =>
        cache.match(event.request).then((cached) => {
          if (cached) return cached;
          return fetch(event.request).then((response) => {
            cache.put(event.request, response.clone());
            return response;
          }).catch(() => undefined);
        })
      )
    );
    return;
  }

  // ── 2. api.auradime.com content — network-first, cache fallback ───────────
  // Statuses, products, orders etc. are cached so users see last-known
  // data when offline, exactly like WhatsApp shows previous messages/statuses.
  if (
    url.hostname === 'api.auradime.com' &&
    event.request.method === 'GET' &&
    isCacheableApiPath(url)
  ) {
    event.respondWith(
      caches.open(API_CACHE_NAME).then((apiCache) =>
        fetch(event.request)
          .then((response) => {
            if (response.ok) {
              apiCache.put(event.request, response.clone());
              apiCache.keys().then((keys) => {
                if (keys.length > API_CACHE_MAX) {
                  keys.slice(0, keys.length - API_CACHE_MAX).forEach((k) => apiCache.delete(k));
                }
              });
            }
            return response;
          })
          .catch(() =>
            apiCache.match(event.request).then(
              (cached) =>
                cached ||
                new Response(
                  JSON.stringify({ success: true, data: [], offline: true }),
                  { status: 200, headers: { 'Content-Type': 'application/json' } }
                )
            )
          )
      )
    );
    return;
  }

  // ── 3. Skip: non-GET, Next.js dynamic data, image-opt, internal API, sockets
  // NOTE: /_next/static/ is intentionally NOT skipped — those are content-hashed
  // JS/CSS bundles we cache for offline JS availability.
  if (
    event.request.method !== 'GET' ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/_next/data/') ||
    url.pathname.startsWith('/_next/image') ||
    url.pathname.startsWith('/socket.io')
  ) {
    return;
  }

  // ── 4. Skip RSC / prefetch requests — must reach the server unchanged ──────
  if (
    url.searchParams.has('_rsc') ||
    event.request.headers.get('RSC') === '1' ||
    event.request.headers.get('Next-Router-Prefetch') === '1' ||
    event.request.headers.get('Next-Router-State-Tree')
  ) {
    return;
  }

  // ── 5. Navigation — stale-while-revalidate ────────────────────────────────
  // Show the cached page immediately; fetch fresh in background and update cache.
  // On offline with no cache for this URL, fall back to /offline page.
  if (
    event.request.mode === 'navigate' ||
    event.request.headers.get('accept')?.includes('text/html')
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(event.request).then((cached) => {
          const networkFetch = fetch(event.request, { cache: 'no-store' })
            .then((response) => {
              if (response.ok) cache.put(event.request, response.clone());
              return response;
            })
            .catch(() =>
              cached ||
              caches.match('/offline').then((offlinePage) =>
                offlinePage ||
                caches.match('/').then((home) =>
                  home ||
                  new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } })
                )
              )
            );
          // Serve cache immediately if we have it; otherwise wait for network.
          return cached || networkFetch;
        })
      )
    );
    return;
  }

  // ── 5b. Status videos — cache full file, serve ranges offline ────────────
  // Background prefetch (no Range header): download + cache the full video.
  // <video> range requests: serve from cached buffer (enables offline playback
  // and instant seek for already-downloaded statuses — same as WhatsApp).
  if (isCacheableVideo(url)) {
    event.respondWith((async () => {
      const videoCache  = await caches.open(VIDEO_CACHE_NAME);
      const rangeHeader = event.request.headers.get('range');

      // Cache hit — serve immediately (with byte-range extraction if needed)
      const cached = await videoCache.match(event.request.url);
      if (cached) {
        if (!rangeHeader) return cached.clone();
        const buf = await cached.clone().arrayBuffer();
        return serveRange(buf, rangeHeader, cached.headers.get('Content-Type') || 'video/mp4');
      }

      // Cache miss + background-prefetch request (no Range header):
      // fetch full video, cache it, return it.
      if (!rangeHeader) {
        try {
          const response = await fetch(new Request(event.request.url, {
            method: 'GET', mode: 'cors', credentials: 'omit',
          }));
          if (response.ok && response.status === 200) {
            const buf  = await response.arrayBuffer();
            const type = response.headers.get('Content-Type') || 'video/mp4';
            if (buf.byteLength > 0 && buf.byteLength <= VIDEO_MAX_BYTES) {
              // Store full response, then evict oldest if over cap
              videoCache.put(event.request.url, new Response(buf.slice(0), {
                status: 200,
                headers: { 'Content-Type': type, 'Content-Length': String(buf.byteLength), 'Accept-Ranges': 'bytes' },
              })).then(() =>
                videoCache.keys().then((keys) => {
                  if (keys.length > VIDEO_CACHE_MAX)
                    keys.slice(0, keys.length - VIDEO_CACHE_MAX).forEach((k) => videoCache.delete(k));
                })
              );
            }
            return new Response(buf, { status: 200, headers: { 'Content-Type': type } });
          }
          return response;
        } catch {
          return new Response('Video unavailable offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
        }
      }

      // Cache miss + Range request from <video> element: pass through to network.
      // (Video will be cached on next background-prefetch cycle.)
      try {
        return await fetch(event.request);
      } catch {
        return new Response('Video unavailable offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
      }
    })());
    return;
  }

  // ── 6. CDN images and /uploads/ — stale-while-revalidate ─────────────────
  if (isCacheableMedia(url)) {
    event.respondWith(
      caches.open(MEDIA_CACHE_NAME).then((mediaCache) =>
        mediaCache.match(event.request).then((cached) => {
          const fetchAndCache = fetch(event.request).then((response) => {
            if (response.ok) {
              mediaCache.put(event.request, response.clone());
              mediaCache.keys().then((keys) => {
                if (keys.length > MEDIA_CACHE_MAX) {
                  keys.slice(0, keys.length - MEDIA_CACHE_MAX).forEach((k) => mediaCache.delete(k));
                }
              });
            }
            return response;
          }).catch(() =>
            cached || new Response('Media unavailable offline', {
              status: 503,
              headers: { 'Content-Type': 'text/plain' },
            })
          );
          return cached || fetchAndCache;
        })
      )
    );
    return;
  }

  // ── 7. All other static assets — cache-first, network fallback ────────────
  // Covers /_next/static/ JS and CSS bundles (content-hashed, safe to cache
  // indefinitely) as well as icons, manifest, and other public files.
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request)
          .then((response) => {
            if (response.ok) cache.put(event.request, response.clone());
            return response;
          })
          .catch(() =>
            new Response('Asset unavailable offline', {
              status: 503,
              headers: { 'Content-Type': 'text/plain' },
            })
          );
      })
    )
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
  const iconRaw = data.icon || '/logo-white.png';
  const icon = iconRaw.startsWith('http') ? iconRaw : baseUrl + iconRaw;
  const badge = baseUrl + '/logo-white.png';
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
    requireInteraction: false,
    silent: false,
    data: {
      url: data.data?.url || data.url || '/',
      payload: data,
      senderData: data.senderData || data.data?.senderData || null,
    },
    actions: isChat
      ? [{ action: 'open', title: 'Reply' }, { action: 'close', title: 'Dismiss' }]
      : [{ action: 'open', title: 'View'  }, { action: 'close', title: 'Dismiss' }],
  };

  const showOrForward = async () => {
    const windowClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const visibleClients = windowClients.filter((c) => c.visibilityState === 'visible');

    // Always forward push data to ALL open tabs — visible or background.
    // Background tabs silently sync message state so the inbox is up-to-date
    // the moment the user switches back to the app.
    // Only ONE visible tab shows the in-app toast (prevents duplicate popups).
    if (visibleClients.length > 0) {
      try { visibleClients[0].postMessage({ type: 'push-received', payload: data }); } catch {}
    }
    for (const client of windowClients) {
      if (visibleClients.includes(client)) continue; // already handled above
      try { client.postMessage({ type: 'push-received', payload: data }); } catch {}
    }

    // Show the OS-level notification whenever the app is not in the foreground,
    // so the user knows a message arrived even if no tab is focused.
    if (visibleClients.length === 0) {
      await self.registration.showNotification(data.title || 'Auradime', options);
    }
  };

  event.waitUntil(showOrForward());
});

// ── Background Sync: offline message queue ────────────────────────────────────
// Fires when connectivity is restored — even if the tab is in the background.
// We tell all open clients to drain their send queue; they handle auth and API.
self.addEventListener('sync', function (event) {
  if (event.tag !== 'aura-send-queue') return;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((allClients) => {
      for (const client of allClients) {
        try { client.postMessage({ type: 'drain-send-queue' }); } catch {}
      }
    })
  );
});

// ── Notification Click ───────────────────────────────────────────────────────
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  if (event.action === 'close') return;

  let urlToOpen = normalizeNotificationUrl(event.notification.data?.url || '/notifications');

  const notifData = event.notification.data || {};
  const innerPayload = notifData.payload || {};
  const senderId =
    innerPayload.sender_id ||
    innerPayload.senderId ||
    innerPayload.data?.sender_id ||
    innerPayload.data?.senderId ||
    null;
  const notificationTitle = event.notification.title || innerPayload.title || null;

  if (notificationTitle) {
    try {
      const parsed = new URL(
        urlToOpen.startsWith('http')
          ? urlToOpen
          : self.location.origin + (urlToOpen.startsWith('/') ? '' : '/') + urlToOpen
      );
      if (!parsed.searchParams.has('notificationTitle')) {
        parsed.searchParams.set('notificationTitle', notificationTitle);
      }
      urlToOpen = parsed.toString();
    } catch {}
  }

  if (!urlToOpen.startsWith('http')) {
    urlToOpen = self.location.origin + (urlToOpen.startsWith('/') ? '' : '/') + urlToOpen;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
          try {
            client.postMessage({
              type:       'notification-click',
              url:        urlToOpen,
              payload:    notifData,
              senderId:   senderId,
              senderData: notifData.senderData || null,
            });
          } catch {}
          return client.focus().then(() => {
            if ('navigate' in client) return client.navigate(urlToOpen);
            return undefined;
          }).catch(() => undefined);
        }
      }
      if (clients.openWindow) return clients.openWindow(urlToOpen);
    })
  );
});
