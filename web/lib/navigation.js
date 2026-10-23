export function normalizeAppRoute(route, fallback = '/notifications') {
  if (!route || typeof route !== 'string') return fallback;

  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'https://auradime.com';
    const url = new URL(route, base);
    const appOrigins = new Set([base, 'https://auradime.com', 'https://www.auradime.com']);
    if (!['http:', 'https:'].includes(url.protocol) || !appOrigins.has(url.origin)) return fallback;
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
    return fallback;
  }
}
