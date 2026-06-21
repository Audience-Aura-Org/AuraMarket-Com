import axios from 'axios';
import { Capacitor } from '@capacitor/core';
import { clearStoredAuthToken, getStoredAuthToken } from './authStorage';

const stripApiPath = (url = '') => url.replace(/\/api(\/v1)?\/?$/, '').replace(/\/$/, '');
const PRODUCTION_API_URL = 'https://api.auradime.com/api/v1';

const getConfiguredApiURL = () => {
  const configured = process.env.NEXT_PUBLIC_API_URL;
  if (!configured) return null;
  return configured.endsWith('/api/v1') ? configured : `${stripApiPath(configured)}/api/v1`;
};

const getBaseURL = () => {
  if (typeof window !== 'undefined') {
    const configuredApiURL = getConfiguredApiURL();
    if (Capacitor.isNativePlatform()) {
      if (!configuredApiURL) {
        console.error('[API] Native build requires NEXT_PUBLIC_API_URL to point at the AWS backend.');
      }
      return configuredApiURL || 'https://api.auradime.com/api/v1';
    }

    if (configuredApiURL) return configuredApiURL;

    const hostname = window.location.hostname;
    
    // Overrides for localhost, loopbacks and emulators (Direct connection)
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:5000/api/v1';
    }
    if (hostname === '10.0.2.2') {
      return 'http://10.0.2.2:5000/api/v1';
    }
    
    // Dynamic fallback for Local Network Testing (Direct connection)
    const isIP = /^[0-9.]+$/.test(hostname);
    if (isIP) {
      return `http://${hostname}:5000/api/v1`;
    }
    
    // 🔥 CRITICAL FIX: For ALL hosted domains (Vercel, etc.), ALWAYS use the Next.js Proxy Bridge.
    // Why? If the EC2 backend is HTTP and the Vercel frontend is HTTPS, the browser will block direct 
    // API calls due to "Mixed Content" security policies, resulting in silent "Network Errors".
    // The Next.js Bridge runs server-side and is immune to Mixed Content and CORS restrictions.
    return PRODUCTION_API_URL;
  }
  
  // Server-side default
  return getConfiguredApiURL() || PRODUCTION_API_URL;
};

const api = axios.create({
  baseURL: getBaseURL(),
  timeout: 300000, // Increased to 5 minutes for large file uploads (100MB)
  withCredentials: true,
  headers: {
    // Don't set default Content-Type here - let axios auto-set based on request type
    // (application/json for JSON, multipart/form-data for FormData)
  },
});

const isFormDataPayload = (value) => {
  if (!value) return false;
  if (typeof FormData !== 'undefined' && value instanceof FormData) return true;
  if (Object.prototype.toString.call(value) === '[object FormData]') return true;
  return typeof value.append === 'function'
    && typeof value.entries === 'function'
    && typeof value.get === 'function';
};

const isNativeApp = () => typeof window !== 'undefined' && Capacitor.isNativePlatform();
const OFFLINE_CACHE_TTL_MS = 3 * 24 * 60 * 60 * 1000;
const CLIENT_FAST_CACHE_TTL_MS = 45 * 1000;
const OFFLINE_CACHE_PREFIX = 'aura_api_cache:';
const clientGetInFlight = new Map();
const OFFLINE_CACHEABLE_ROUTES = [
  /^homepage(?:\/|$)/,
  /^products(?:\/|$)/,
  /^categories(?:\/|$)/,
  /^vendors(?:\/|$)/,
  /^statuses(?:\/|$)/,
  /^reviews\/product(?:\/|$)/,
];

const getOfflineStorage = () => {
  if (typeof window === 'undefined') return null;
  try {
    const storage = window.localStorage;
    const probe = `${OFFLINE_CACHE_PREFIX}probe`;
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    try {
      return window.sessionStorage;
    } catch {
      return null;
    }
  }
};

const normalizeCacheUrl = (url = '') =>
  String(url)
    .replace(/^\/+/, '')
    .replace(/^api\/v1\//, '')
    .replace(/^api\//, '');

const isOfflineCacheableRoute = (url = '') => {
  const normalized = normalizeCacheUrl(url);
  if (
    normalized.startsWith('auth/') ||
    normalized.startsWith('admin/') ||
    normalized.startsWith('wallet') ||
    normalized.startsWith('payments/') ||
    normalized.startsWith('orders') ||
    normalized.startsWith('cart') ||
    normalized.startsWith('checkout') ||
    normalized.startsWith('notifications') ||
    normalized.startsWith('users/') ||
    normalized.startsWith('security/')
  ) {
    return false;
  }
  if (normalized.startsWith('chat/admin')) return false;
  return OFFLINE_CACHEABLE_ROUTES.some((route) => route.test(normalized));
};

const hashCacheScope = (value = '') => {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
};

const getAuthCacheScope = (config) => {
  const authHeader =
    config?.headers?.Authorization ||
    config?.headers?.authorization ||
    '';
  return authHeader ? `auth:${hashCacheScope(authHeader)}` : 'public';
};

const getCacheKey = (config) => {
  const url = config?.url || '';
  const params = config?.params ? JSON.stringify(config.params) : '';
  return `${OFFLINE_CACHE_PREFIX}${getAuthCacheScope(config)}:${normalizeCacheUrl(url)}:${params}`;
};
const canUseOfflineCache = (config) =>
  typeof window !== 'undefined' &&
  (config?.method || 'get').toLowerCase() === 'get' &&
  isOfflineCacheableRoute(config?.url || '');

const saveOfflineCache = (config, data) => {
  const storage = getOfflineStorage();
  if (!storage) return;
  storage.setItem(getCacheKey(config), JSON.stringify({
    cachedAt: Date.now(),
    data,
  }));
};

const readOfflineCache = (config) => {
  const storage = getOfflineStorage();
  if (!storage) return null;
  const cached = JSON.parse(storage.getItem(getCacheKey(config)) || 'null');
  if (!cached?.data) return null;
  if (Date.now() - Number(cached.cachedAt || 0) > OFFLINE_CACHE_TTL_MS) {
    storage.removeItem(getCacheKey(config));
    return null;
  }
  return cached;
};

// Correctly derive origin for asset normalization
const getApiOrigin = () => {
  if (typeof window !== 'undefined') {
    if (Capacitor.isNativePlatform()) {
      return stripApiPath(getBaseURL());
    }

    const isLocal = window.location.hostname === 'localhost' ||
                   window.location.hostname === '127.0.0.1' ||
                   window.location.hostname === '10.0.2.2';
    if (!isLocal) return window.location.origin;
  }
  return getBaseURL().replace(/\/api\/v1\/?$/, '');
};

const API_ORIGIN = getApiOrigin();

const normalizeAssetUrls = (value) => {
  if (typeof value === 'string') {
    // 1. Handle relative paths from the new upload logic
    if (/^\/?uploads\//i.test(value)) {
      return `${API_ORIGIN}/${value.replace(/^\/+/, '')}`;
    }
    // 2. Fix legacy absolute URLs that might have been hardcoded to local hosts
    return value.replace(/^https?:\/\/(localhost|127\.0\.0\.1):5000/i, API_ORIGIN);
  }

  if (Array.isArray(value)) {
    return value.map(normalizeAssetUrls);
  }

  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, v] of Object.entries(value)) {
      out[key] = normalizeAssetUrls(v);
    }
    return out;
  }

  return value;
};

// Interceptor to attach JWT token and normalize URLs
api.interceptors.request.use(async (config) => {
  // Normalize URL to ensure it doesn't conflict with baseURL
  if (config.url?.startsWith('/')) {
    config.url = config.url.substring(1);
  }

  if (typeof window !== 'undefined') {
    const language = window.localStorage.getItem('aura_language') || 'en';
    config.headers['Accept-Language'] = language;
    config.headers['X-Aura-Language'] = language;

    const token = await getStoredAuthToken();
    
    if (token && token !== 'undefined' && token !== 'null' && token !== '') {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Mobile browsers can fail `instanceof FormData` across realms.
    // For FormData, we must NOT set Content-Type manually — the browser/XHR
    // must set it automatically so it can inject the correct multipart boundary.
    // Using `delete` on an AxiosHeaders object can break boundary injection on
    // some mobile/Capacitor environments. Setting to undefined is the safe approach.
    if (isFormDataPayload(config.data)) {
      const hadContentType = !!config.headers['Content-Type'];
      // Unset in all the ways axios may have it stored
      config.headers['Content-Type'] = undefined;
      config.headers['content-type'] = undefined;
      if (typeof config.headers.setContentType === 'function') {
        config.headers.setContentType(undefined);
      }
      console.log('[API:Interceptor] FormData detected for:', config.url, {
        hasContentType: hadContentType,
        headerKeys: Object.keys(config.headers).filter(k => config.headers[k] !== undefined),
      });
    } else {
      config.headers['Content-Type'] = 'application/json';
    }
  }
  return config;
});

// -----------------------------
// Response retry interceptor
// -----------------------------
const shouldRetry = (error) => {
  if (!error || !error.config) return false;
  if (error.config.__skipRetry) return false;
  const status = error.response?.status;
  // Do not retry 429s: retrying a rate-limited request only deepens the lockout.
  return status !== 429 && !error.response;
};

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

const isInvalidStoredSession = (status, message = '') => {
  const normalized = String(message).toLowerCase();
  if (status === 401) {
    return normalized.includes('user belonging to this token no longer exists') ||
      normalized.includes('session is no longer valid') ||
      normalized.includes('jwt expired') ||
      normalized.includes('invalid token');
  }

  return status === 403 && normalized.includes('deactivated');
};

let lastInvalidSessionNoticeAt = 0;
const notifyInvalidStoredSession = async (message) => {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  if (now - lastInvalidSessionNoticeAt < 5000) return;
  lastInvalidSessionNoticeAt = now;
  try {
    await clearStoredAuthToken();
    window.localStorage.removeItem('aura-auth-storage');
    window.sessionStorage.removeItem('onboarding_skipped');
  } catch {}
  window.dispatchEvent(new CustomEvent('aura:session-invalidated', {
    detail: { message },
  }));
};

api.interceptors.response.use(
  (res) => {
    const responseType = res?.config?.responseType;
    const isBinaryResponse =
      responseType === 'blob' ||
      responseType === 'arraybuffer' ||
      (typeof Blob !== 'undefined' && res?.data instanceof Blob) ||
      (typeof ArrayBuffer !== 'undefined' && res?.data instanceof ArrayBuffer);

    if (res?.data && !isBinaryResponse) {
      res.data = normalizeAssetUrls(res.data);
    }
    if (canUseOfflineCache(res.config)) {
      try {
        saveOfflineCache(res.config, res.data);
      } catch {}
    }
    return res;
  },
  async (error) => {
    const config = error.config;
    if (!config) return Promise.reject(error);

    if (!error.response && canUseOfflineCache(config)) {
      try {
        const cached = readOfflineCache(config);
        if (cached?.data) {
          return {
            data: cached.data,
            status: 200,
            statusText: 'OK (offline cache)',
            headers: {},
            config,
            request: error.request,
            offlineCache: true,
          };
        }
      } catch {}
    }

    config.__retryCount = config.__retryCount || 0;
    const MAX_RETRIES = 2; // Reduced from 4 — fail fast, don't hang

    if (config.__retryCount >= MAX_RETRIES || !shouldRetry(error)) {
      if (error.response) {
        const status = error.response.status;
        const message = error.response.data?.message || 'Check network tab';
        if (isInvalidStoredSession(status, message)) {
          await notifyInvalidStoredSession(message);
        }
        if (status === 402 && error.response.data?.code === 'SUBSCRIPTION_REQUIRED' && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('aura:subscription-required', {
            detail: error.response.data,
          }));
        }
        
        // Silence 401s for guests (it's expected on some routes like /cart)
        const normalizedUrl = normalizeCacheUrl(config.url || '');
        const isAuthMeProbe = normalizedUrl === 'auth/me';
        const isExpectedOtpCooldown = status === 429 && normalizedUrl === 'auth/send-otp';
        if (status !== 401) {
          if (!isExpectedOtpCooldown) {
            console.warn(`[API] ${status} Error at ${config.url}: ${message}`);
          }
        } else if (!isAuthMeProbe) {
          // Note: We deliberately DO NOT wipe localStorage here anymore.
          // Random 401s (e.g. hitting a protected route before Zustand hydrates)
          // were incorrectly logging users out on refresh.
          console.warn(`[API] 401 (UNAUTHORIZED) — ${config.url} — SERVER_MSG: ${message}`);
        }
      } else {
        console.warn(`[API Network/Unknown Error] at ${config.url}: ${error.message}`);
      }
      return Promise.reject(error);
    }

    config.__retryCount += 1;

    // Exponential backoff with jitter: base 500ms
    const baseDelay = 500;
    const backoff = baseDelay * Math.pow(2, config.__retryCount - 1);
    const jitter = Math.floor(Math.random() * 300);
    const delay = backoff + jitter;

    console.warn(`[API] Retry ${config.__retryCount}/${MAX_RETRIES} after ${delay}ms for ${config.url}`);
    await sleep(delay);
    return api(config);
  }
);

const rawGet = api.get.bind(api);

api.get = async (url, config = {}) => {
  const normalizedConfig = {
    ...config,
    url,
    method: 'get',
  };

  if (!config?.skipClientCache && canUseOfflineCache(normalizedConfig)) {
    let scopedConfig = normalizedConfig;
    if (typeof window !== 'undefined') {
      const token = await getStoredAuthToken();
      if (token && token !== 'undefined' && token !== 'null' && token !== '') {
        scopedConfig = {
          ...normalizedConfig,
          headers: {
            ...(normalizedConfig.headers || {}),
            Authorization: `Bearer ${token}`,
          },
        };
      }
    }

    const key = getCacheKey(scopedConfig);
    const cached = readOfflineCache(scopedConfig);
    if (cached?.data && Date.now() - Number(cached.cachedAt || 0) <= CLIENT_FAST_CACHE_TTL_MS) {
      return {
        data: cached.data,
        status: 200,
        statusText: 'OK (client cache)',
        headers: {},
        config: scopedConfig,
        request: null,
        clientCache: true,
      };
    }

    if (clientGetInFlight.has(key)) {
      return clientGetInFlight.get(key);
    }

    const request = rawGet(url, config).finally(() => {
      clientGetInFlight.delete(key);
    });
    clientGetInFlight.set(key, request);
    return request;
  }

  return rawGet(url, config);
};

export default api;
