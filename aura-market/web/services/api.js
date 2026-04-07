import axios from 'axios';


const getBaseURL = () => {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== 'undefined') {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocal) return `http://localhost:5000/api/v1`;
    
    // In production, force HTTPS if the current page is HTTPS to avoid Mixed Content
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    return `${protocol}//${window.location.hostname}/api/v1`;
  }
  return 'http://localhost:5000/api/v1';
};

const api = axios.create({
  baseURL: getBaseURL(),
  headers: {
    'Content-Type': 'application/json',
  },
});

const API_ORIGIN = getBaseURL().replace(/\/api\/v1\/?$/, '');

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

// Interceptor to attach JWT token to requests
api.interceptors.request.use((config) => {
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
    const MAX_RETRIES = 4;

    if (config.__retryCount >= MAX_RETRIES || !shouldRetry(error)) {
      if (error.response) {
        const status = error.response.status;
        const message = error.response.data?.message || 'Check network tab';
        
        // Silence 401s for guests (it's expected on some routes like /cart)
        if (status !== 401) {
          console.warn(`[API] ${status} Error at ${config.url}: ${message}`);
        }
        
        // Auto-logout on 401 (token expired/invalid) to prevent background 401 loop
        if (status === 401 && typeof window !== 'undefined') {
          try {
            localStorage.removeItem('aura-auth-storage');
            localStorage.removeItem('aura_token');
            // We don't force page reload here to avoid infinite loops, 
            // but the next hook call will see the empty state.
          } catch (e) { /* ignore */ }
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

