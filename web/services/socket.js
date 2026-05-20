import { io } from 'socket.io-client';

const getSocketURL = () => {
  // 1. Priority: Explicitly defined socket URL
  if (process.env.NEXT_PUBLIC_SOCKET_URL) return process.env.NEXT_PUBLIC_SOCKET_URL;

  // 2. Derive from API URL if available (most reliable for production)
  // Example: "https://aura-backend.herokuapp.com/api/v1" -> "https://aura-backend.herokuapp.com"
  if (process.env.NEXT_PUBLIC_API_URL) {
    // Robustly strip /api/v1 or just /api from the end
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/api(\/v1)?\/?$/, '');
  }

  // 3. Browser-side fallbacks
  if (typeof window !== 'undefined') {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocal) {
      return 'http://localhost:5000';
    }
    
    // On Vercel, window.location.origin is NOT a socket server.
    // If we've reached here on HTTPS, we're likely missing the API URL env var.
    if (window.location.protocol === 'https:') {
      console.warn('[Socket] NEXT_PUBLIC_API_URL is missing. Socket may fail.');
    }
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

  connect(userId) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('aura_token') : null;

    if (this.socket) {
      const currentAuth = this.socket.auth || {};
      if (currentAuth.userId === userId && currentAuth.token === token) {
        if (this.socket.connected) {
          console.log('⚡ Socket already connected with correct credentials, skipping reconnect');
          return;
        }
        console.log('⚡ Socket exists but disconnected, attempting reconnect...');
        this.socket.connect();
        return;
      }

      console.log('⚡ Socket credentials changed, updating auth and forcing reconnect...');
      this.socket.auth = { userId, token };
      this.socket.disconnect().connect();
      return;
    }

    this.connectionAttempts++;
    console.log(`⚡ [Attempt ${this.connectionAttempts}] Connecting to WebSocket at: ${SOCKET_URL}`);
    console.log(`   Auth Token: ${(typeof window !== 'undefined' ? localStorage.getItem('aura_token') : 'N/A')?.substring(0, 20)}...`);

    this.socket = io(SOCKET_URL, {
      auth: { 
        userId, 
        token: (typeof window !== 'undefined' ? localStorage.getItem('aura_token') : null) 
      },
      // Start with polling, then upgrade to websocket for maximum compatibility
      // Polling is more reliable on networks with strict firewalls or reverse proxies
      transports: ['polling', 'websocket'],
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      randomizationFactor: 0.5,
      upgrade: true,
      path: '/socket.io',
      withCredentials: true,
      // Advanced: Help with debugging connection issues
      transportOptions: {
        polling: {
          extraHeaders: {
            'X-Client': 'AuraMarket-Web'
          }
        }
      }
    });

    this.socket.on('connect', () => {
      try {
        const transport = this.socket.io?.engine?.transport?.name || 'unknown';
        console.log(`✅ Connected to Aura Socket (${this.socket.id}) | Transport: ${transport} | Attempts: ${this.connectionAttempts}`);
        this.lastError = null;
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
          console.log(`✅ Reattached ${reattached} listeners after reconnect`);
        }
      } catch (connectErr) {
        console.error('[SocketService] Critical error in connect handler:', connectErr);
      }
    });

    this.socket.on('connect_error', (err) => {
      try {
        const errorMsg = err?.message || err?.toString?.() || 'Unknown error';
        console.warn(`⚠️ Socket Connect Error (Attempt ${this.connectionAttempts}): ${errorMsg}`);
        console.warn(`   URL: ${SOCKET_URL}`);
        console.warn(`   This is usually temporary. Retrying...`);
        console.warn(`   Full error:`, err);
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
        console.warn(`🔌 Socket disconnected | Reason: ${reason}`);
        // Mark all listeners as not attached so they're re-attached on reconnect
        if (this.listeners instanceof Map) {
          this.listeners.forEach((eventMap) => {
            if (eventMap instanceof Map) {
              for (const [callbackId, entry] of eventMap.entries()) {
                if (entry && typeof entry === 'object') {
                  eventMap.set(callbackId, { ...entry, attached: false });
                }
              }
            }
          });
        }
      } catch (e) {
        console.error('[SocketService] Error in disconnect handler:', e);
      }
    });
  }

  disconnect() {
    if (this.socket) {
      console.log('🔌 Disconnecting socket');
      this.socket.disconnect();
      this.socket = null;
    }
    this.listeners.clear();
    this.connectionAttempts = 0;
    this.lastError = null;
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
          // console.log(`✅ Listener attached for event: "${event}"`);
        } catch (attachErr) {
          console.error(`[SocketService] Failed to attach listener for event "${event}":`, attachErr);
          eventMap.set(callbackId, { callback, attached: false });
        }
      } else {
        console.log(`⏳ Event "${event}" queued - will attach on socket connect`);
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
              // console.log(`✅ Listener removed for event: "${event}"`);
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
        // console.log(`✅ All listeners removed for event: "${event}"`);
      }
    } catch (e) {
      console.error('[SocketService] Error in off() method:', e);
    }
  }

  emit(event, data) {
    try {
      if (!this.socket) {
        console.warn(`⚠️ Cannot emit "${event}" - socket not initialized`);
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
