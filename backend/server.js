/**
 * server.js
 * Auradime — Main Express Server Entry Point
 *
 * Responsibilities:
 *  - Load and validate environment variables
 *  - Connect to MongoDB
 *  - Configure Express middleware (CORS, JSON parsing, etc.)
 *  - Mount API routes
 *  - Handle 404 and global errors
 *  - Start HTTP server
 */

// ─────────────────────────────────────────────
// 1. Load environment variables first
// ─────────────────────────────────────────────
const { validateEnv, PORT, WEB_CLIENT_URL, NODE_ENV } = require('./config/env');
validateEnv();

// ─────────────────────────────────────────────
// 2. Core imports
// ─────────────────────────────────────────────
const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const compression = require('compression');

// ─────────────────────────────────────────────
// 3. Config imports
// ─────────────────────────────────────────────
const connectDB = require('./config/database');

// ─────────────────────────────────────────────
// 4. Middleware imports
// ─────────────────────────────────────────────
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');
const { apiLimiter, strictLimiter } = require('./middleware/rateLimiter');
const setLocale = require('./middleware/locale.middleware');

// ─────────────────────────────────────────────
// 5. Connect to MongoDB
// ─────────────────────────────────────────────
connectDB();

// Verify Titan SMTP connection at startup
const { verifyConnection } = require('./utils/emailService');
verifyConnection();

// ─────────────────────────────────────────────
// 6. Initialize Express app, HTTP server, & WebSockets
// ─────────────────────────────────────────────
const app = express();
app.set('trust proxy', 1); // 🔥 ESSENTIAL: Render/Proxy identity mapping
const server = http.createServer(app);

// Initialize Socket.io Chat Events
const mapChatSockets = require('./sockets/chat.socket');
const io = mapChatSockets(server);
app.set('io', io);

const { startEscrowAutoReleaseWorker } = require('./services/escrowAutoRelease.service');
startEscrowAutoReleaseWorker(app);

// ─────────────────────────────────────────────
// 7. Express Middleware
// ─────────────────────────────────────────────
const os = require('os');

// Get all local network IPs for development
const getLocalIPs = () => {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const [, addrs] of Object.entries(interfaces)) {
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) {
        ips.push(addr.address);
      }
    }
  }
  return ips;
};

const localIPs = getLocalIPs();
const allowedOrigins = [
  'https://space.audienceaura.org',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://10.0.2.2:3000',      // Android Emulator Loopback
  'capacitor://localhost',
  'http://localhost',
  process.env.WEB_CLIENT_URL,
].filter(Boolean);

// Add all local network IPs to CORS for development
for (const ip of localIPs) {
  allowedOrigins.push(`http://${ip}:3000`);
  allowedOrigins.push(`http://${ip}:5000`);
}

app.use(cors({
  origin: (origin, callback) => {
    // Dynamically allow the exact requesting origin (Reflect origin).
    // This completely prevents CORS errors regardless of where the frontend is hosted.
    callback(null, origin || true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));

app.use(compression()); // Gzip all API responses
// ── Eversend Webhook (Raw Body Requirement) ───────────────────────────
// Must be mounted before express.json() to allow raw body HMAC verification
const { eversendWebhook } = require('./controllers/payment.controller');
app.post('/api/v1/payments/eversend/webhook', express.raw({ type: 'application/json' }), eversendWebhook);
app.post('/api/payments/eversend/webhook', express.raw({ type: 'application/json' }), eversendWebhook);

app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: true, limit: '500mb' }));

// Apply general rate limit to all requests
app.use('/api', apiLimiter);

// Global localization handling
app.use(setLocale);

// ─────────────────────────────────────────────
// 8. Health Check Route
// ─────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: '🚀 Auradime API is running',
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// Root Welcome Route
app.get('/', (req, res) => {
  res.send('<h1>Welcome to the Aura Dime API!</h1><p>Visit <a href="/api/health">/api/health</a> to check system status.</p>');
});

// Serve static uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─────────────────────────────────────────────
// 9. API Routes
// ─────────────────────────────────────────────
app.use('/api/v1', require('./routes/v1.router')); // Specific fallback first
app.use('/api', require('./routes/v1.router'));    // Unified fallback last


// ─────────────────────────────────────────────
// 10. Error Handling (must be LAST)
// ─────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─────────────────────────────────────────────
// 11. Start Server
// ─────────────────────────────────────────────
server.listen(PORT, '0.0.0.0', () => {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  let ipAddress = 'localhost';
  
  for (const [name, addrs] of Object.entries(interfaces)) {
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) {
        ipAddress = addr.address;
        break;
      }
    }
  }
  
  console.log(`\n🚀 Auradime server running in ${NODE_ENV} mode on port ${PORT}`);
  console.log(`   Access locally: http://localhost:${PORT}/api/health`);
  console.log(`   Access from other devices: http://${ipAddress}:${PORT}/api/health`);
  console.log(`   All interfaces: http://0.0.0.0:${PORT}/api/health\n`);
});

// Increase server timeouts for large file uploads (100MB videos)
server.timeout = 600000; // 10 minutes
server.keepAliveTimeout = 610000; // Slightly more than keepAlive to avoid race conditions
server.headersTimeout = 620000;

// ─────────────────────────────────────────────
// 12. Handle unhandled promise rejections
// ─────────────────────────────────────────────
process.on('unhandledRejection', (err) => {
  console.error(`❌ Unhandled Rejection: ${err.message}`);
  server.close(() => process.exit(1));
});

module.exports = app;
