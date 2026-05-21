import axios from 'axios';


const getBaseURL = () => {
  if (typeof window !== 'undefined') {
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
    return '/api/v1';
  }
  
  // Server-side default
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
};

const api = axios.create({
  baseURL: getBaseURL(),
  timeout: 300000, // Increased to 5 minutes for large file uploads (100MB)
  headers: {
    'Content-Type': 'application/json',
  },
});

// Correctly derive origin for asset normalization
const getApiOrigin = () => {
  if (typeof window !== 'undefined') {
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
    if (value.startsWith('/uploads/')) {
      return `${API_ORIGIN}${value}`;
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
api.interceptors.request.use((config) => {
  // Normalize URL to ensure it doesn't conflict with baseURL
  if (config.url?.startsWith('/')) {
    config.url = config.url.substring(1);
  }

  if (typeof window !== 'undefined') {
    let token = null;

    // 1. Try to get token from localStorage directly to avoid circular dependency with the store
    try {
      const stored = localStorage.getItem('aura-auth-storage');
      if (stored) {
        const parsed = JSON.parse(stored);
        token = parsed?.state?.token;
      }
    } catch (e) {
      console.error('[API Interceptor] Failed to parse auth storage:', e);
    }

    // 2. Fallback to legacy key
    if (!token) {
      token = localStorage.getItem('aura_token');
    }
    
    if (token && token !== 'undefined' && token !== 'null' && token !== '') {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// -----------------------------
// Response retry interceptor
// -----------------------------
const shouldRetry = (error) => {
  if (!error || !error.config) return false;
  const status = error.response?.status;
  // Retry on 429 (rate limit) or network errors
  return status === 429 || !error.response;
};

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

api.interceptors.response.use(
  (res) => {
    if (res?.data) {
      res.data = normalizeAssetUrls(res.data);
    }
    return res;
  },
  async (error) => {
    const config = error.config;
    if (!config) return Promise.reject(error);

    config.__retryCount = config.__retryCount || 0;
    const MAX_RETRIES = 2; // Reduced from 4 — fail fast, don't hang

    if (config.__retryCount >= MAX_RETRIES || !shouldRetry(error)) {
      if (error.response) {
        const status = error.response.status;
        const message = error.response.data?.message || 'Check network tab';
        
        // Silence 401s for guests (it's expected on some routes like /cart)
        if (status !== 401) {
          console.warn(`[API] ${status} Error at ${config.url}: ${message}`);
        } else {
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

export default api;

