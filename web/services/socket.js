import { io } from 'socket.io-client';
import { Capacitor } from '@capacitor/core';
import { getStoredAuthToken } from './authStorage';

const stripApiPath = (url = '') => url.replace(/\/api(\/v1)?\/?$/, '').replace(/\/$/, '');

const isSocketDebugEnabled = () => process.env.NEXT_PUBLIC_SOCKET_DEBUG === 'true';
const debugLog = (...args) => {
  if (isSocketDebugEnabled()) console.debug(...args);
};
const debugWarn = (...args) => {
  if (isSocketDebugEnabled()) console.warn(...args);
};

const isLocalHost = (hostname = '') => (
  hostname === 'localhost' ||
  hostname === '127.0.0.1' ||
  hostname === '10.0.2.2' ||
  hostname.endsWith('.localhost') ||
  hostname.startsWith('192.168.') ||
  hostname.startsWith('10.') ||
  hostname.startsWith('172.16.') ||
  hostname.startsWith('172.17.') ||
  hostname.startsWith('172.18.') ||
  hostname.startsWith('172.19.') ||
  hostname.startsWith('172.20.') ||
  hostname.startsWith('172.21.') ||
  hostname.startsWith('172.22.') ||
  hostname.startsWith('172.23.') ||
  hostname.startsWith('172.24.') ||
  hostname.startsWith('172.25.') ||
  hostname.startsWith('172.26.') ||
  hostname.startsWith('172.27.') ||
  hostname.startsWith('172.28.') ||
  hostname.startsWith('172.29.') ||
  hostname.startsWith('172.30.') ||
  hostname.startsWith('172.31.')
);

const normalizeSocketURL = (candidate, source = 'socket config') => {
  if (!candidate) return null;

  const raw = stripApiPath(candidate);

  if (typeof window === 'undefined') {
    return raw;
  }

  try {
    const url = new URL(raw, window.location.origin);
    const pageIsSecure = window.location.protocol === 'https:';
    const socketIsInsecure = url.protocol === 'http:' || url.protocol === 'ws:';

    if (pageIsSecure && socketIsInsecure && !isLocalHost(url.hostname)) {
      console.error(
        `[SocketService] Refusing insecure ${source} "${raw}" from HTTPS production. ` +
        'Set NEXT_PUBLIC_SOCKET_URL to an HTTPS/WSS Socket.IO origin, for example https://api.yourdomain.com.'
      );
      return null;
    }

    return url.origin;
  } catch (error) {
    console.error(`[SocketService] Invalid ${source}:`, candidate, error);
    return null;
  }
};

const getSocketURL = () => {
  // 1. Priority: Explicitly defined socket URL
  const explicitSocketURL = normalizeSocketURL(process.env.NEXT_PUBLIC_SOCKET_URL, 'NEXT_PUBLIC_SOCKET_URL');
  if (explicitSocketURL) return explicitSocketURL;

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const origin = window.location.origin || '';
    
    // Detect Capacitor or mobile webview environment where hostname is 'localhost'
    const isCapacitor = Capacitor.isNativePlatform() ||
                       origin.startsWith('capacitor://') || 
                       (hostname === 'localhost' && (window.Capacitor || window.cordova || /Android|iPhone|iPad/i.test(navigator.userAgent)));

    // For mobile native apps, DO NOT use localhost:5000 since the backend is on the PC/Cloud.
    // Derive from process.env.NEXT_PUBLIC_API_URL (which has the developer's PC IP or production domain)
    if (isCapacitor && process.env.NEXT_PUBLIC_API_URL) {
      debugLog('[SocketService] Mobile container detected. Deriving socket server from API URL.');
      const capacitorSocketURL = normalizeSocketURL(process.env.NEXT_PUBLIC_API_URL, 'NEXT_PUBLIC_API_URL');
      if (capacitorSocketURL) return capacitorSocketURL;
    }

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:5000';
    }
    if (hostname === '10.0.2.2') {
      return 'http://10.0.2.2:5000';
    }
    const isIP = /^[0-9.]+$/.test(hostname);
    if (isIP && window.location.protocol !== 'https:') {
      return `http://${hostname}:5000`;
    }
  }

  // 2. Derive from API URL if available (most reliable for production)
  // Example: "https://aura-backend.herokuapp.com/api/v1" -> "https://aura-backend.herokuapp.com"
  if (process.env.NEXT_PUBLIC_API_URL) {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      const isWindowLocal = hostname.includes('localhost') || hostname.includes('127.0.0.1') || /^[0-9.]+$/.test(hostname);
      if (!isWindowLocal && process.env.NEXT_PUBLIC_API_URL.includes('192.168.')) {
        return normalizeSocketURL(window.location.origin, 'window origin');
      }
    }
    const apiSocketURL = normalizeSocketURL(process.env.NEXT_PUBLIC_API_URL, 'NEXT_PUBLIC_API_URL');
    if (apiSocketURL) return apiSocketURL;
  }

  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    console.error(
      '[SocketService] No secure Socket.IO URL is configured for production. ' +
      'Set NEXT_PUBLIC_SOCKET_URL to the HTTPS/WSS origin that serves /socket.io.'
    );
    return null;
  }

  return 'http://localhost:5000';
};

const SOCKET_URL = getSocketURL();

class SocketService {
  socket = null;
  // Track listeners with unique IDs to prevent duplicates across reconnects
  listeners = new Map(); // Map<event, Map<callbackId, { callback, attached: boolean }>>
  callbackCounter = 0;
  connectionAttempts = 0;
  lastError = null;
  warnedUnavailable = false;

  async connect(userId) {
    if (!SOCKET_URL) {
      this.lastError = 'Missing secure production socket URL. Set NEXT_PUBLIC_SOCKET_URL to an HTTPS/WSS Socket.IO origin.';
      if (!this.warnedUnavailable) {
        console.error(`[SocketService] ${this.lastError}`);
        this.warnedUnavailable = true;
      }
      return;
    }

    const token = await getStoredAuthToken();

    if (this.socket) {
      if (this.socket.currentUserId === userId) {
        if (this.socket.connected) {
          debugLog('[SocketService] Already connected, skipping reconnect.');
          return;
        }
        debugLog('[SocketService] Socket exists but disconnected, attempting reconnect.');
        this.socket.connect();
        return;
      }

      debugLog('[SocketService] User changed, reconnecting with new credentials.');
      this.socket.currentUserId = userId;
      this.socket.disconnect().connect();
      return;
    }

    this.connectionAttempts++;
    debugLog(`[SocketService] Connecting. Attempt: ${this.connectionAttempts}`);

    this.socket = io(SOCKET_URL, {
      auth: (cb) => {
        getStoredAuthToken()
          .then((t) => {
            cb({ userId: this.socket?.currentUserId || userId, token: t });
          })
          .catch(() => {
            cb({ userId: this.socket?.currentUserId || userId, token: null });
          });
      },
      // Fast connection strategy: connect via polling instantly, then upgrade to WebSocket in the background.
      transports: ['polling', 'websocket'],
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      randomizationFactor: 0.5,
      upgrade: true,
      path: '/socket.io',
      withCredentials: true,
      transportOptions: {
        polling: {
          extraHeaders: {
            'X-Client': 'Auradime-Web'
          }
        }
      }
    });
    this.socket.currentUserId = userId;

    this.socket.on('connect', () => {
      try {
        const transport = this.socket.io?.engine?.transport?.name || 'unknown';
        debugLog(`[SocketService] Connected. Transport: ${transport}. Attempts: ${this.connectionAttempts}`);
        
        // Log transport details for debugging
        if (transport === 'websocket') {
          debugLog('[SocketService] Using WebSocket transport.');
        } else if (transport === 'polling') {
          debugWarn('[SocketService] Using polling transport fallback.');
        }
        
        this.lastError = null;
        this.warnedUnavailable = false;
        this.connectionAttempts = 0; // Reset on successful connect
        
        // Attach listeners that haven't been attached yet (bulletproof)
        let reattached = 0;
        if (!this.listeners || !(this.listeners instanceof Map)) {
          console.warn('[SocketService] Invalid listeners map on connect');
          return;
        }

        this.listeners.forEach((eventMap, event) => {
          try {
            if (!(eventMap instanceof Map)) {
              console.warn('[SocketService] Expected Map for listeners of', event);
              return;
            }

            for (const [callbackId, entry] of eventMap.entries()) {
              try {
                // Strict validation of entry object
                if (!entry || typeof entry !== 'object') {
                  console.warn('[SocketService] Invalid entry structure', { event, callbackId, entry });
                  continue;
                }

                const callback = entry.callback || null;
                const attached = entry.attached === true; // explicit true check

                if (attached) continue;

                if (typeof callback !== 'function') {
                  console.warn('[SocketService] Skipping non-function listener', { event, callbackId });
                  continue;
                }

                // Wrap listener to prevent callback errors from bubbling into socket internals
                const safeCb = (...args) => {
                  try {
                    callback(...args);
                  } catch (cbErr) {
                    console.error('[SocketService] Listener callback error for', event, cbErr);
                  }
                };

                this.socket.on(event, safeCb);

                // Store wrapper so we can remove it later if needed
                eventMap.set(callbackId, { callback, attached: true, wrapper: safeCb });
                reattached++;
              } catch (entryErr) {
                console.error(`[SocketService] Error processing entry ${callbackId} for event ${event}:`, entryErr);
              }
            }
          } catch (eventErr) {
            console.error(`[SocketService] Error attaching listeners for event ${event}:`, eventErr);
          }
        });

        if (reattached > 0) {
          debugLog(`[SocketService] Reattached ${reattached} listeners after reconnect.`);
        }
      } catch (connectErr) {
        console.error('[SocketService] Critical error in connect handler:', connectErr);
      }
    });

    this.socket.on('connect_error', (err) => {
      try {
        const errorMsg = err?.message || err?.toString?.() || 'Unknown error';
        debugWarn(`[SocketService] Connect error. Attempt: ${this.connectionAttempts}. Message: ${errorMsg}`);
        
        // Provide specific guidance based on error type
        if (errorMsg.includes('xhr poll error') || errorMsg.includes('ERR_NAME_NOT_RESOLVED') || errorMsg.includes('ECONNREFUSED')) {
          debugWarn('[SocketService] Backend socket server may be unavailable or blocked.');
        } else if (errorMsg.includes('403') || errorMsg.includes('Forbidden')) {
          debugWarn('[SocketService] Possible CORS or auth middleware issue.');
        } else if (errorMsg.includes('401') || errorMsg.includes('Unauthorized')) {
          debugWarn('[SocketService] Auth token may be invalid or expired.');
        }
        
        debugWarn('[SocketService] Retrying with exponential backoff.');
        this.lastError = errorMsg;
      } catch (e) {
        console.error('[SocketService] Error in connect_error handler:', e);
      }
    });

    this.socket.on('error', (err) => {
      try {
        const errorMsg = err?.message || err?.toString?.() || 'Unknown error';
        console.error(`❌ Socket Error: ${errorMsg}`);
        console.error(`   Full error:`, err);
        this.lastError = errorMsg;
      } catch (e) {
        console.error('[SocketService] Error in error handler:', e);
      }
    });

    this.socket.on('disconnect', (reason) => {
      try {
        debugWarn(`[SocketService] Disconnected. Reason: ${reason}`);
      } catch (e) {
        console.error('[SocketService] Error in disconnect handler:', e);
      }
    });
  }

  disconnect() {
    if (this.socket) {
      debugLog('[SocketService] Disconnecting socket.');
      this.socket.disconnect();
      this.socket = null;
    }
    this.listeners.clear();
    this.connectionAttempts = 0;
    this.lastError = null;
    this.warnedUnavailable = false;
  }

  isConnected() {
    return this.socket && this.socket.connected;
  }

  getTransport() {
    if (!this.socket) return null;
    return this.socket.io?.engine?.transport?.name || 'unknown';
  }

  getLastError() {
    return this.lastError;
  }

  on(event, callback) {
    try {
      // Create or get the event map
      if (!this.listeners || !(this.listeners instanceof Map)) {
        console.warn('[SocketService] Invalid listeners map in on()');
        return;
      }

      if (!this.listeners.has(event)) {
        this.listeners.set(event, new Map());
      }
      const eventMap = this.listeners.get(event);

      if (!(eventMap instanceof Map)) {
        console.warn('[SocketService] Expected Map for event', event);
        return;
      }

      // Validate callback
      if (typeof callback !== 'function') {
        console.warn('[SocketService] on() called with non-function callback for', event);
        return;
      }

      // Use callback itself as ID to prevent duplicates
      const callbackId = this.callbackCounter++;
      eventMap.set(callbackId, { callback, attached: false });

      // If socket is connected, attach immediately with a safe wrapper
      if (this.socket && this.socket.connected) {
        try {
          const safeCb = (...args) => {
            try {
              callback(...args);
            } catch (cbErr) {
              console.error('[SocketService] Listener callback error for', event, cbErr);
            }
          };
          this.socket.on(event, safeCb);
          eventMap.set(callbackId, { callback, attached: true, wrapper: safeCb });
        } catch (attachErr) {
          console.error(`[SocketService] Failed to attach listener for event "${event}":`, attachErr);
          eventMap.set(callbackId, { callback, attached: false });
        }
      } else {
        debugLog(`[SocketService] Event "${event}" queued until socket connects.`);
      }
    } catch (e) {
      console.error('[SocketService] Error in on() method:', e);
    }
  }

  off(event, callbackToRemove) {
    try {
      if (!this.listeners || !(this.listeners instanceof Map)) {
        console.warn('[SocketService] Invalid listeners map in off()');
        return;
      }

      if (!this.listeners.has(event)) {
        return; // No listeners for this event
      }

      const eventMap = this.listeners.get(event);

      if (!(eventMap instanceof Map)) {
        console.warn('[SocketService] Expected Map for event', event);
        return;
      }

      if (callbackToRemove) {
        // Remove only the specific listener
        for (const [id, entry] of eventMap.entries()) {
          try {
            if (!entry || typeof entry !== 'object') continue;

            const { callback, wrapper } = entry;
            if (callback === callbackToRemove) {
              if (this.socket) {
                try {
                  // Remove the wrapper from socket if present, otherwise remove original
                  if (wrapper && typeof wrapper === 'function') {
                    this.socket.off(event, wrapper);
                  } else if (typeof callback === 'function') {
                    this.socket.off(event, callback);
                  }
                } catch (e) {
                  console.warn('[SocketService] Error removing listener from socket:', e);
                }
              }
              eventMap.delete(id);
              break;
            }
          } catch (e) {
            console.error('[SocketService] Error processing listener entry in off():', e);
          }
        }
        if (eventMap.size === 0) {
          this.listeners.delete(event);
        }
      } else {
        // Remove all listeners for the event
        for (const [id, entry] of eventMap.entries()) {
          try {
            if (entry && typeof entry === 'object' && this.socket) {
              const { callback, wrapper } = entry;
              if (wrapper && typeof wrapper === 'function') {
                this.socket.off(event, wrapper);
              } else if (typeof callback === 'function') {
                this.socket.off(event, callback);
              }
            }
          } catch (e) {
            console.warn('[SocketService] Error removing listener in off():', e);
          }
        }
        this.listeners.delete(event);
      }
    } catch (e) {
      console.error('[SocketService] Error in off() method:', e);
    }
  }

  emit(event, data) {
    try {
      if (!this.socket) {
        if (!this.warnedUnavailable) {
          console.warn(`⚠️ Cannot emit "${event}" - socket not initialized`);
          this.warnedUnavailable = true;
        }
        return;
      }
      if (!this.socket.connected) {
        console.warn(`⚠️ Cannot emit "${event}" - socket not connected (status: ${this.socket.disconnected ? 'disconnected' : 'connecting'})`);
        return;
      }
      this.socket.emit(event, data);
    } catch (e) {
      console.error('[SocketService] Error in emit() method:', e);
    }
  }

  get connected() {
    return this.socket && this.socket.connected;
  }
}

const socketService = new SocketService();
export default socketService;
