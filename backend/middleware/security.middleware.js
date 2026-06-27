const os = require('os');

const BLOCKED_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

const getLocalIPs = () => {
  const interfaces = os.networkInterfaces();
  const ips = [];

  for (const addrs of Object.values(interfaces)) {
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) {
        ips.push(addr.address);
      }
    }
  }

  return ips;
};

const escapeRegExp = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const sanitizeValue = (value, seen = new WeakSet()) => {
  if (typeof value === 'string') {
    return value.replace(CONTROL_CHARS, '');
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  if (value instanceof Date || Buffer.isBuffer(value)) {
    return value;
  }

  if (seen.has(value)) {
    return value;
  }
  seen.add(value);

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      value[i] = sanitizeValue(value[i], seen);
    }
    return value;
  }

  for (const key of Object.keys(value)) {
    if (key.startsWith('$') || key.includes('.') || BLOCKED_KEYS.has(key)) {
      delete value[key];
      continue;
    }

    value[key] = sanitizeValue(value[key], seen);
  }

  return value;
};

const sanitizeInput = (req, res, next) => {
  sanitizeValue(req.body);
  sanitizeValue(req.query);
  sanitizeValue(req.params);
  next();
};

const securityHeaders = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  }

  next();
};

const normalizeOrigin = (origin = '') => origin.replace(/\/$/, '').toLowerCase();

const createAllowedOrigins = () => {
  const origins = [
    'https://auradime.com',
    'https://www.auradime.com',
    'https://api.auradime.com',
    'https://space.audienceaura.org',
    'http://localhost',
    'http://localhost:3000',
    'http://localhost:5000',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5000',
    'http://10.0.2.2:3000',
    'http://10.0.2.2:5000',
    'capacitor://localhost',
    process.env.WEB_CLIENT_URL,
    process.env.NEXT_PUBLIC_FRONTEND_URL,
  ].filter(Boolean);

  for (const ip of getLocalIPs()) {
    origins.push(`http://${ip}:3000`);
    origins.push(`http://${ip}:5000`);
  }

  return new Set(origins.map(normalizeOrigin));
};

const isAllowedOrigin = (origin, allowedOrigins = createAllowedOrigins()) => {
  if (!origin) return true;

  const normalized = normalizeOrigin(origin);
  if (allowedOrigins.has(normalized)) return true;

  try {
    const { hostname, protocol } = new URL(normalized);
    if (protocol === 'capacitor:') return hostname === 'localhost';
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '10.0.2.2') return true;
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
    if (hostname === 'auradime.com' || hostname.endsWith('.auradime.com')) return true;
    if (hostname === 'vercel.app' || hostname.endsWith('.vercel.app')) return true;
  } catch (error) {
    return false;
  }

  return false;
};

const createCorsOptions = () => {
  const allowedOrigins = createAllowedOrigins();

  return {
    origin: (origin, callback) => {
      callback(null, isAllowedOrigin(origin, allowedOrigins));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Accept-Language',
      'X-Aura-Language',
      'Origin',
    ],
    exposedHeaders: ['Content-Length', 'X-Auradime-Cache'],
    optionsSuccessStatus: 204,
  };
};

module.exports = {
  createCorsOptions,
  escapeRegExp,
  sanitizeInput,
  securityHeaders,
};
